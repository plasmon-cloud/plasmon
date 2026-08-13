# Resource type / MIME / language duplicate-table audit

Refresh: integrated release `f4ac3b4`; no active #178 PR and #189 is integrated.
This audit is code-inspected, not a claim that any candidate is safe to delete.
The ordinary classifier seam is now `classifyResource(node).type`; downstream
retirement still requires consumer-by-consumer evidence.

| File/helper | Owner | Current consumers | Semantic purpose | Duplicate? | Removable by #178? | Other Issue / do-not-touch reason |
|---|---|---|---|---|---|---|
| `src/os/fs/resourcePolicy.ts::classifyResource` | Fs/resource authority | Search, FileManager, desktop, managed FS | semantic kind + ownership + validated app metadata | no | no; upstream authority | preserve released #189 vocabulary |
| `src/native-apps/text/editorModel.ts::LANGUAGE_BY_EXTENSION` | Text | historical/compatibility adapter only on integrated release | Monaco language hint from filename | superseded by `editorLanguageForResource` | yes, after release promotion audit | #178/#200; verify no stale consumer before deletion |
| `src/os/shell/search.ts::MEDIA_EXTENSIONS` | Search | no longer canonical in integrated #189 Search path | legacy candidate | superseded in integrated source | #178/#193/#201 | verify current release import/consumer graph before deletion |
| `src/os/file-manager/file-icons.ts::IMAGE_EXTENSIONS` | FileManager | `resourceIconKind` | icon kind / thumbnail eligibility | yes, partial | not automatically | #196/#190 presentation; icon policy is not MIME authority |
| `src/os/file-manager/file-icons.ts::VIDEO_EXTENSIONS` | FileManager | same | video icon kind | yes, partial | not automatically | #94/#196; browser/media acceptance boundary |
| `src/os/file-manager/file-icons.ts::SOURCE_EXTENSIONS` | FileManager | text icon kind | source/text icon fallback | yes, partial | maybe after canonical presentation | #196/#190; visual fallback may remain |
| `src/os/file-manager/thumbnail.ts::IMAGE_MIME_BY_EXTENSION` | FileManager | thumbnail MIME resolver | image thumbnail request MIME | yes, partial | no direct deletion | #93; decoder/thumbnail policy separate |
| `src/native-apps/photos/media.ts::EXTENSION_MIME` | Photos | `inferImageMime`, tests/content associations | image MIME/eligible extensions | yes, partial | maybe after #178, but Photos API contract first | #93; do not break image decode policy |
| `src/native-apps/photos/media.ts::IMAGE_EXTENSIONS/IMAGE_MIME_TYPES` | Photos | content-app associations, tests | supported Photos handler set | no pure duplicate | no | association handler ownership |
| `src/native-apps/video/media.ts::VIDEO_MIME` | Video | `inferVideoMime`, tests | video MIME fallback | yes, partial | maybe after shared type seam | #94; actual supported formats must remain |
| `src/native-apps/video/media.ts::VIDEO_EXTENSIONS` | Video | video app | video extension support | likely partial | not without app contract | #94 browser/media boundary |
| `src/native-apps/content-apps.ts` rules | Associations | HandlerAssociationRegistry | open-handler registration | no | no | AssociationRegistry authority remains independent |
| `src/os/associations/registry.ts` normalization/matching | Associations | Open With/open service | MIME/extension matching and defaults | no | no | opening authority, not generic classifier |
| `src/native-apps/text/editorModel.ts::editorLanguageForName` | Text | TextEditor | language hint API | duplicate consumer logic | yes after new API | no fake overload; #200 host consumes hint |
| `src/os/shell/search.ts::fileSubtitle` | Search | Search results | display string | no | no | presentation consumer; may consume canonical MIME |
| `src/os/sharing/provider.ts::resourceType` fallback | Sharing | atom/document sharing | sharing resource type | not necessarily | no | sharing contract uses atom/resource identity, audit separately |

## Exhaustive search result

The important duplicate authorities are not all semantically equivalent:
Photos/video thumbnail decode support, FileManager icon fallback, Association
handler registration, Search category, and Monaco language are different
contracts. #178 should centralize ordinary resource derivation, then migrate
consumers deliberately. It must not delete format-specific browser helpers or
association rules merely because both contain a suffix.

## Low-noise future restrictions

After migrations, consider static checks only for:

1. Search importing a deprecated local classifier;
2. Text/Markdown importing a deprecated extension language table;
3. Properties/FileManager deriving semantic kind from suffix directly.

Do not ban all extension strings: association registrations, browser media
support, and package asset names legitimately need them.
