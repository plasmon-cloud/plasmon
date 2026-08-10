import type {
  AssociationRegistry,
  AtomDescriptor,
  FsNode,
  HandlerDefinition,
  HandlerId,
  OpenService,
  OpenTarget,
} from "../contracts/index.ts";
import { tryGetAtomDescriptorFromNode } from "./atom.ts";
import { tryParseAtomPackage } from "./atomPackage.ts";
import { tryParseInternetShortcut } from "./shortcut.ts";

interface DefaultKeyAssociationRegistry extends AssociationRegistry {
  defaultTypeKeyFor(node: FsNode, handlerId: HandlerId, contentProbe?: Uint8Array): Promise<string | null>;
}

function supportsDefaultKeyResolution(registry: AssociationRegistry): registry is DefaultKeyAssociationRegistry {
  return typeof (registry as Partial<DefaultKeyAssociationRegistry>).defaultTypeKeyFor === "function";
}

export interface OpenWithCandidate {
  handler: HandlerDefinition;
  isDefault: boolean;
}

export interface OpenWithModel {
  nodeId: string;
  name: string;
  target: OpenTarget;
  defaultHandlerId: HandlerId | null;
  candidates: readonly OpenWithCandidate[];
  warnings: readonly string[];
}

export class OpenWithServiceModel {
  private readonly registry: AssociationRegistry;
  private readonly openService: OpenService;

  constructor(registry: AssociationRegistry, openService: OpenService) {
    this.registry = registry;
    this.openService = openService;
  }

  private async inspect(node: FsNode, contentProbe?: Uint8Array): Promise<{ atom: AtomDescriptor | null; url: string | null; warnings: string[] }> {
    const warnings: string[] = [];
    let atom: AtomDescriptor | null = null;
    const metadataAtom = tryGetAtomDescriptorFromNode(node);
    if (metadataAtom?.ok) atom = metadataAtom.descriptor;
    else if (metadataAtom && !metadataAtom.ok) warnings.push(metadataAtom.error.message);

    if (!atom && contentProbe && (node.kind === "atom" || node.name.toLowerCase().endsWith(".atom"))) {
      const packageResult = await tryParseAtomPackage(contentProbe);
      if (packageResult.ok) atom = packageResult.package.descriptor;
      else warnings.push(packageResult.error.message);
    }

    let url: string | null = null;
    if (contentProbe && (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url"))) {
      const shortcut = tryParseInternetShortcut(contentProbe);
      if (shortcut.ok) url = shortcut.shortcut.url;
      else warnings.push(shortcut.error.message);
    }
    return { atom, url, warnings };
  }

  async model(node: FsNode, contentProbe?: Uint8Array): Promise<OpenWithModel> {
    const inspection = await this.inspect(node, contentProbe);
    const handlers = await this.registry.resolve(node, contentProbe);
    const defaultHandlerId = handlers[0]?.id ?? null;
    const target: OpenTarget = {
      nodeId: node.id,
      ...(inspection.atom ? { atom: inspection.atom } : {}),
      ...(inspection.url ? { url: inspection.url } : {}),
    };
    return {
      nodeId: node.id,
      name: node.name,
      target,
      defaultHandlerId,
      candidates: handlers.map((handler) => ({ handler, isDefault: handler.id === defaultHandlerId })),
      warnings: inspection.warnings,
    };
  }

  async open(node: FsNode, handlerId: HandlerId, contentProbe?: Uint8Array): Promise<void> {
    const model = await this.model(node, contentProbe);
    if (!model.candidates.some((candidate) => candidate.handler.id === handlerId)) {
      throw new Error(`Handler ${handlerId} is not compatible with ${node.name}`);
    }
    await this.openService.open(handlerId, model.target);
  }

  async setDefault(node: FsNode, handlerId: HandlerId, contentProbe?: Uint8Array): Promise<string> {
    const model = await this.model(node, contentProbe);
    if (!model.candidates.some((candidate) => candidate.handler.id === handlerId)) {
      throw new Error(`Handler ${handlerId} is not compatible with ${node.name}`);
    }
    if (!supportsDefaultKeyResolution(this.registry)) {
      throw new Error("Association registry cannot determine which matcher applies to the selected handler");
    }
    const typeKey = await this.registry.defaultTypeKeyFor(node, handlerId, contentProbe);
    if (!typeKey) throw new Error(`Handler ${handlerId} has no defaultable association matcher for ${node.name}`);
    await this.registry.setUserDefault(typeKey, handlerId);
    return typeKey;
  }
}
