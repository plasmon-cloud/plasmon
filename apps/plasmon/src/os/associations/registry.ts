import type {
  AssociationRegistry,
  AssociationRule,
  AtomDescriptor,
  FsNode,
  HandlerCapability,
  HandlerDefinition,
  HandlerId,
} from "../contracts/index.ts";
import { tryGetAtomDescriptorFromNode } from "./atom.ts";
import { tryParseAtomPackage } from "./atomPackage.ts";
import {
  associationTypeKey,
  MemoryAssociationDefaultStore,
  normalizeAssociationTypeKey,
  normalizeExtension,
  normalizeMime,
  type AssociationDefaultStore,
} from "./defaults.ts";
import { resolveShortcutHandlerId, tryParseInternetShortcut } from "./shortcut.ts";

const VALID_CAPABILITIES = new Set<HandlerCapability>(["read", "write", "share", "url"]);
const DEFAULT_SHORTCUT_ALIASES: Readonly<Record<string, HandlerId>> = Object.freeze({
  browser: "native:browser",
  webbrowser: "native:browser",
  videoplayer: "native:video",
});

interface NormalizedRule {
  id: string;
  handlerId: HandlerId;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  atomTypes: readonly string[];
  priority: number;
}

interface Match {
  handlerId: HandlerId;
  stage: number;
  specificity: number;
  priority: number;
  ruleId: string;
  typeKey?: string;
}

const NO_DEFAULTS: ReadonlySet<string> = new Set<string>();

export interface AssociationRegistryOptions {
  defaults?: AssociationDefaultStore;
  shortcutAliases?: Readonly<Record<string, HandlerId>>;
}

function metadataString(node: FsNode, key: string): string | null {
  const value = node.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mimeSpecificity(ruleMime: string): number {
  if (ruleMime === "*/*") return 0;
  if (ruleMime.endsWith("/*")) return 1;
  return 2;
}

function mimeMatches(ruleMime: string, actualMime: string): boolean {
  if (ruleMime === "*/*") return true;
  if (ruleMime.endsWith("/*")) return actualMime.startsWith(`${ruleMime.slice(0, -1)}`);
  return ruleMime === actualMime;
}

function extensionParts(name: string): { ordinary: string | null; compounds: string[] } {
  const lower = name.toLowerCase();
  const dots: number[] = [];
  for (let index = 0; index < lower.length; index += 1) if (lower[index] === ".") dots.push(index);
  if (!dots.length || dots[0] === 0 && dots.length === 1) return { ordinary: null, compounds: [] };
  const last = dots[dots.length - 1];
  if (last === undefined || last === lower.length - 1) return { ordinary: null, compounds: [] };
  const ordinary = lower.slice(last);
  const compounds = dots
    .filter((dot) => dot !== last && dot > 0)
    .map((dot) => lower.slice(dot))
    .filter((suffix) => suffix.length > ordinary.length)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  return { ordinary, compounds };
}

function compareMatch(a: Match, b: Match, defaults: ReadonlySet<string>): number {
  if (a.stage !== b.stage) return a.stage - b.stage;
  const aDefault = a.typeKey !== undefined && defaults.has(`${a.typeKey}\u0000${a.handlerId}`) ? 1 : 0;
  const bDefault = b.typeKey !== undefined && defaults.has(`${b.typeKey}\u0000${b.handlerId}`) ? 1 : 0;
  if (aDefault !== bDefault) return bDefault - aDefault;
  if (a.specificity !== b.specificity) return b.specificity - a.specificity;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const rule = a.ruleId.localeCompare(b.ruleId);
  return rule || a.handlerId.localeCompare(b.handlerId);
}

export class HandlerAssociationRegistry implements AssociationRegistry {
  private readonly handlers = new Map<HandlerId, HandlerDefinition>();
  private readonly rules = new Map<string, NormalizedRule>();
  private readonly defaults: AssociationDefaultStore;
  private readonly shortcutAliases: Readonly<Record<string, HandlerId>>;

  constructor(options: AssociationRegistryOptions = {}) {
    this.defaults = options.defaults ?? new MemoryAssociationDefaultStore();
    this.shortcutAliases = Object.freeze({
      ...DEFAULT_SHORTCUT_ALIASES,
      ...Object.fromEntries(Object.entries(options.shortcutAliases ?? {}).map(([key, value]) => [key.toLowerCase(), value])),
    });
  }

  registerHandler(handler: HandlerDefinition): void {
    if (!handler.id.trim()) throw new Error("Handler id cannot be empty");
    if (!handler.name.trim()) throw new Error(`Handler ${handler.id} must have a name`);
    for (const capability of handler.capabilities) {
      if (!VALID_CAPABILITIES.has(capability)) throw new Error(`Handler ${handler.id} has an invalid capability: ${capability}`);
    }
    this.handlers.set(handler.id, { ...handler, capabilities: [...handler.capabilities] });
  }

  registerRule(rule: AssociationRule): void {
    if (!rule.id.trim()) throw new Error("Association rule id cannot be empty");
    if (!this.handlers.has(rule.handlerId)) throw new Error(`Association rule references unknown handler: ${rule.handlerId}`);
    if (!Number.isFinite(rule.priority)) throw new Error(`Association rule ${rule.id} has an invalid priority`);
    const extensions = [...new Set((rule.extensions ?? []).map(normalizeExtension))];
    const mimeTypes = [...new Set((rule.mimeTypes ?? []).map(normalizeMime))];
    const atomTypes = [...new Set((rule.atomTypes ?? []).map((value) => value.trim()).filter(Boolean))];
    if (atomTypes.length !== (rule.atomTypes ?? []).filter((value) => value.trim()).length) {
      throw new Error(`Association rule ${rule.id} contains duplicate Atom types`);
    }
    if (extensions.length === 0 && mimeTypes.length === 0 && atomTypes.length === 0) {
      throw new Error(`Association rule ${rule.id} must declare at least one matcher`);
    }
    if ((rule.atomTypes ?? []).some((value) => !value.trim())) throw new Error(`Association rule ${rule.id} contains an empty Atom type`);
    this.rules.set(rule.id, { id: rule.id, handlerId: rule.handlerId, extensions, mimeTypes, atomTypes, priority: rule.priority });
  }

  getHandler(id: HandlerId): HandlerDefinition | null {
    const handler = this.handlers.get(id);
    return handler ? { ...handler, capabilities: [...handler.capabilities] } : null;
  }

  async setUserDefault(typeKey: string, handlerId: HandlerId): Promise<void> {
    if (!this.handlers.has(handlerId)) throw new Error(`Unknown handler: ${handlerId}`);
    await this.defaults.set(normalizeAssociationTypeKey(typeKey), handlerId);
  }

  async clearUserDefault(typeKey: string): Promise<void> {
    await this.defaults.delete(normalizeAssociationTypeKey(typeKey));
  }

  private addRuleMatches(matches: Match[], rule: NormalizedRule, predicate: (rule: NormalizedRule) => Match[]): void {
    matches.push(...predicate(rule));
  }

  private async atomDescriptor(node: FsNode, contentProbe?: Uint8Array): Promise<AtomDescriptor | null> {
    const metadata = tryGetAtomDescriptorFromNode(node);
    if (metadata?.ok) return metadata.descriptor;
    if (contentProbe && (node.kind === "atom" || node.name.toLowerCase().endsWith(".atom"))) {
      const parsed = await tryParseAtomPackage(contentProbe);
      if (parsed.ok) return parsed.package.descriptor;
    }
    return null;
  }

  private async collectMatches(node: FsNode, contentProbe?: Uint8Array): Promise<Match[]> {
    const matches: Match[] = [];
    const explicit = metadataString(node, "opensWith");
    if (explicit && this.handlers.has(explicit)) matches.push({ handlerId: explicit, stage: 0, specificity: 0, priority: Number.MAX_SAFE_INTEGER, ruleId: "~opensWith" });

    const atom = await this.atomDescriptor(node, contentProbe);
    if (atom) {
      if (this.handlers.has(atom.handlerId)) matches.push({ handlerId: atom.handlerId, stage: 1, specificity: 0, priority: Number.MAX_SAFE_INTEGER, ruleId: "~atom-handler" });
      for (const rule of this.rules.values()) {
        if (rule.atomTypes.includes(atom.atomType)) {
          matches.push({ handlerId: rule.handlerId, stage: 2, specificity: 0, priority: rule.priority, ruleId: rule.id, typeKey: associationTypeKey.atomType(atom.atomType) });
        }
      }
    }

    let shortcutHandler: HandlerId | null = null;
    if (contentProbe && (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url"))) {
      const shortcut = tryParseInternetShortcut(contentProbe);
      if (shortcut.ok) shortcutHandler = resolveShortcutHandlerId(shortcut.shortcut, this.shortcutAliases);
    }
    if (shortcutHandler && this.handlers.has(shortcutHandler)) {
      matches.push({ handlerId: shortcutHandler, stage: 3, specificity: 0, priority: Number.MAX_SAFE_INTEGER, ruleId: "~shortcut-handler" });
    }

    const { ordinary, compounds } = extensionParts(node.name);
    for (const rule of this.rules.values()) {
      this.addRuleMatches(matches, rule, (candidateRule) => {
        const ruleMatches: Match[] = [];
        for (const extension of candidateRule.extensions) {
          const compoundIndex = compounds.indexOf(extension);
          if (compoundIndex >= 0) {
            ruleMatches.push({
              handlerId: candidateRule.handlerId,
              stage: 4,
              specificity: extension.length,
              priority: candidateRule.priority,
              ruleId: candidateRule.id,
              typeKey: associationTypeKey.extension(extension),
            });
          } else if (ordinary === extension) {
            ruleMatches.push({
              handlerId: candidateRule.handlerId,
              stage: 5,
              specificity: extension.length,
              priority: candidateRule.priority,
              ruleId: candidateRule.id,
              typeKey: associationTypeKey.extension(extension),
            });
          }
        }
        return ruleMatches;
      });
    }

    if (node.mime) {
      let actualMime: string | null = null;
      try { actualMime = normalizeMime(node.mime); } catch { actualMime = null; }
      if (actualMime) {
        for (const rule of this.rules.values()) {
          for (const ruleMime of rule.mimeTypes) {
            if (!mimeMatches(ruleMime, actualMime)) continue;
            matches.push({
              handlerId: rule.handlerId,
              stage: 6,
              specificity: mimeSpecificity(ruleMime),
              priority: rule.priority,
              ruleId: rule.id,
              typeKey: associationTypeKey.mime(actualMime),
            });
          }
        }
      }
    }

    return matches;
  }

  async defaultTypeKeyFor(node: FsNode, handlerId: HandlerId, contentProbe?: Uint8Array): Promise<string | null> {
    const matches = (await this.collectMatches(node, contentProbe))
      .filter((match): match is Match & { typeKey: string } => match.handlerId === handlerId && match.typeKey !== undefined);
    matches.sort((a, b) => compareMatch(a, b, NO_DEFAULTS));
    return matches[0]?.typeKey ?? null;
  }

  async resolve(node: FsNode, contentProbe?: Uint8Array): Promise<HandlerDefinition[]> {
    const matches = await this.collectMatches(node, contentProbe);
    const typeKeys = [...new Set(matches.flatMap((match) => match.typeKey ? [match.typeKey] : []))];
    const defaults = new Set<string>();
    await Promise.all(typeKeys.map(async (typeKey) => {
      const handlerId = await this.defaults.get(typeKey);
      if (handlerId) defaults.add(`${typeKey}\u0000${handlerId}`);
    }));

    matches.sort((a, b) => compareMatch(a, b, defaults));
    const seen = new Set<HandlerId>();
    const result: HandlerDefinition[] = [];
    for (const match of matches) {
      if (seen.has(match.handlerId)) continue;
      const handler = this.handlers.get(match.handlerId);
      if (!handler) continue;
      seen.add(match.handlerId);
      result.push({ ...handler, capabilities: [...handler.capabilities] });
    }
    return result;
  }

  async getDefault(node: FsNode): Promise<HandlerDefinition | null> {
    return (await this.resolve(node))[0] ?? null;
  }
}

export function associationTypeKeysForNode(node: FsNode, atom?: AtomDescriptor | null): string[] {
  const keys: string[] = [];
  if (atom) keys.push(associationTypeKey.atomType(atom.atomType));
  const { ordinary, compounds } = extensionParts(node.name);
  for (const compound of compounds) keys.push(associationTypeKey.extension(compound));
  if (ordinary) keys.push(associationTypeKey.extension(ordinary));
  if (node.mime) {
    try { keys.push(associationTypeKey.mime(node.mime)); } catch { /* malformed MIME has no stable default key */ }
  }
  return [...new Set(keys)];
}
