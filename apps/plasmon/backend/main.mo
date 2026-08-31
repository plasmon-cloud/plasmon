import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Runtime "mo:core/Runtime";
import Memory "./memory/hello/v1";
import SharingMemory "./memory/sharing/v1";
import Sha256 "./sharing/Sha256";

module {
    let SHARING_SCHEMA_VERSION : Nat = 1;
    let MAX_CHUNK_BYTES : Nat = 1048576;

    public type SharingChunkRef = {
        hash : Blob;
        size : Nat;
    };

    public type SharingAtomSnapshot = {
        format : Text;
        version : Nat;
        atomId : Text;
        handlerId : Text;
        atomType : Text;
        schemaVersion : Nat;
        title : ?Text;
    };

    public type SharingSnapshot = {
        displayName : Text;
        kind : Text;
        mime : ?Text;
        atom : ?SharingAtomSnapshot;
    };

    public type SharingRevision = {
        schemaVersion : Nat;
        namespace : Text;
        resourceId : Text;
        resourceType : Text;
        revision : Nat;
        byteLength : Nat;
        contentRootHash : Blob;
        chunks : [SharingChunkRef];
        snapshot : SharingSnapshot;
        createdAt : Nat64;
    };

    public type SharingResourceSummary = {
        schemaVersion : Nat;
        namespace : Text;
        resourceId : Text;
        resourceType : Text;
        currentRevision : Nat;
        createdAt : Nat64;
        updatedAt : Nat64;
    };

    public type SharingPutChunkResult = {
        #stored;
        #deduplicated;
        #err : Text;
    };

    public type SharingCommitResult = {
        #ok : SharingRevision;
        #conflict : ?Nat;
        #err : Text;
    };

    public type AppBackendEnvironment = {
        stable_memory : {
            hello : Memory.Mem;
            sharing : SharingMemory.Mem;
        };
    };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.hello;
        let sharing = env.stable_memory.sharing;

        func append<T>(items : [T], item : T) : [T] {
            Array.tabulate<T>(items.size() + 1, func(index : Nat) : T {
                if (index < items.size()) items[index] else item;
            });
        };

        func replaceAt<T>(items : [T], index : Nat, item : T) : [T] {
            Array.tabulate<T>(items.size(), func(current : Nat) : T {
                if (current == index) item else items[current];
            });
        };

        func findChunkIndex(hash : Blob) : ?Nat {
            var index = 0;
            while (index < sharing.chunks.size()) {
                if (Blob.equal(sharing.chunks[index].hash, hash)) return ?index;
                index += 1;
            };
            null;
        };

        func findResourceIndex(namespace : Text, resourceId : Text) : ?Nat {
            var index = 0;
            while (index < sharing.resources.size()) {
                let resource = sharing.resources[index];
                if (resource.namespace == namespace and resource.resourceId == resourceId) return ?index;
                index += 1;
            };
            null;
        };

        func revisionByNumber(resource : SharingMemory.Resource, revision : Nat) : ?SharingMemory.Revision {
            var index = 0;
            while (index < resource.revisions.size()) {
                if (resource.revisions[index].revision == revision) return ?resource.revisions[index];
                index += 1;
            };
            null;
        };

        func summary(resource : SharingMemory.Resource) : SharingMemory.ResourceSummary {
            {
                schemaVersion = resource.schemaVersion;
                namespace = resource.namespace;
                resourceId = resource.resourceId;
                resourceType = resource.resourceType;
                currentRevision = resource.currentRevision;
                createdAt = resource.createdAt;
                updatedAt = resource.updatedAt;
            };
        };

        func validNamespace(namespace : Text) : Bool {
            namespace == "plasmon.atom" or namespace == "plasmon.file";
        };

        func validSnapshot(namespace : Text, resourceId : Text, resourceType : Text, snapshot : SharingMemory.Snapshot) : Bool {
            if (snapshot.displayName == "") return false;
            if (snapshot.kind != "file" and snapshot.kind != "shortcut" and snapshot.kind != "atom") return false;

            if (namespace == "plasmon.atom") {
                if (snapshot.kind != "atom") return false;
                switch (snapshot.atom) {
                    case null false;
                    case (?atom) {
                        atom.format == "plasmon.atom" and
                        atom.version == 1 and
                        atom.atomId == resourceId and
                        atom.atomType == resourceType and
                        atom.handlerId != "";
                    };
                };
            } else {
                switch (snapshot.atom) {
                    case null true;
                    case (?_) false;
                };
            };
        };

        func checkedChunk(hash : Blob) : ?Blob {
            switch (findChunkIndex(hash)) {
                case null null;
                case (?index) {
                    let stored = sharing.chunks[index];
                    if (not Blob.equal(Sha256.digest(stored.bytes), stored.hash)) {
                        Runtime.trap("sharing provider stored chunk failed SHA-256 integrity verification");
                    };
                    ?stored.bytes;
                };
            };
        };

        public func /*update*/hello_world(name : Text) : Text {
            let prev = mem.name;
            mem.name := name;
            prev;
        };

        public func /*query*/sharing_schema_version() : Nat {
            sharing.schemaVersion;
        };

        public func /*query*/sharing_has_chunk(hash : Blob) : Bool {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return false;
            switch (checkedChunk(hash)) {
                case null false;
                case (?_) true;
            };
        };

        public func /*update*/sharing_put_chunk(hash : Blob, bytes : Blob) : SharingPutChunkResult {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return #err("sharing schema version mismatch");
            if (hash.size() != 32) return #err("chunk hash must be 32 bytes");
            if (bytes.size() > MAX_CHUNK_BYTES) return #err("chunk exceeds 1 MiB provider limit");
            if (not Blob.equal(Sha256.digest(bytes), hash)) return #err("chunk SHA-256 mismatch");

            switch (findChunkIndex(hash)) {
                case (?index) {
                    let existing = sharing.chunks[index];
                    if (not Blob.equal(Sha256.digest(existing.bytes), hash)) {
                        return #err("existing chunk failed SHA-256 integrity verification");
                    };
                    #deduplicated;
                };
                case null {
                    sharing.chunks := append<SharingMemory.Chunk>(sharing.chunks, { hash; bytes });
                    #stored;
                };
            };
        };

        public func /*query*/sharing_get_chunk(hash : Blob) : ?Blob {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return null;
            checkedChunk(hash);
        };

        public func /*query*/sharing_describe(namespace : Text, resourceId : Text) : ?SharingResourceSummary {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return null;
            switch (findResourceIndex(namespace, resourceId)) {
                case null null;
                case (?index) ?summary(sharing.resources[index]);
            };
        };

        public func /*query*/sharing_get_revision(namespace : Text, resourceId : Text, revision : ?Nat) : ?SharingRevision {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return null;
            switch (findResourceIndex(namespace, resourceId)) {
                case null null;
                case (?index) {
                    let resource = sharing.resources[index];
                    let selected = switch (revision) {
                        case null resource.currentRevision;
                        case (?value) value;
                    };
                    revisionByNumber(resource, selected);
                };
            };
        };

        public func /*query*/sharing_read_resource_chunk(namespace : Text, resourceId : Text, revision : Nat, chunkIndex : Nat) : ?Blob {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return null;
            switch (findResourceIndex(namespace, resourceId)) {
                case null null;
                case (?index) {
                    switch (revisionByNumber(sharing.resources[index], revision)) {
                        case null null;
                        case (?published) {
                            if (chunkIndex >= published.chunks.size()) return null;
                            let ref = published.chunks[chunkIndex];
                            switch (checkedChunk(ref.hash)) {
                                case null null;
                                case (?bytes) {
                                    if (bytes.size() != ref.size) {
                                        Runtime.trap("sharing provider chunk size integrity failure");
                                    };
                                    ?bytes;
                                };
                            };
                        };
                    };
                };
            };
        };

        public func /*update*/sharing_commit_revision(
            namespace : Text,
            resourceId : Text,
            resourceType : Text,
            expectedRevision : ?Nat,
            byteLength : Nat,
            contentRootHash : Blob,
            chunks : [SharingChunkRef],
            snapshot : SharingSnapshot,
            createdAt : Nat64,
        ) : SharingCommitResult {
            if (sharing.schemaVersion != SHARING_SCHEMA_VERSION) return #err("sharing schema version mismatch");
            if (not validNamespace(namespace)) return #err("unsupported provider namespace");
            if (resourceId == "" or resourceType == "") return #err("resource identity/type is required");
            if (contentRootHash.size() != 32) return #err("content root must be 32 bytes");
            if (not validSnapshot(namespace, resourceId, resourceType, snapshot)) return #err("invalid provider snapshot metadata");

            var totalSize = 0;
            let hashes = Array.tabulate<Blob>(chunks.size(), func(index : Nat) : Blob { chunks[index].hash });
            let sizes = Array.tabulate<Nat>(chunks.size(), func(index : Nat) : Nat { chunks[index].size });
            var chunkIndex = 0;
            while (chunkIndex < chunks.size()) {
                let ref = chunks[chunkIndex];
                if (ref.hash.size() != 32) return #err("chunk hash must be 32 bytes");
                if (ref.size > MAX_CHUNK_BYTES) return #err("chunk exceeds 1 MiB provider limit");
                switch (checkedChunk(ref.hash)) {
                    case null return #err("referenced chunk is missing");
                    case (?bytes) {
                        if (bytes.size() != ref.size) return #err("referenced chunk size mismatch");
                    };
                };
                totalSize += ref.size;
                chunkIndex += 1;
            };
            if (totalSize != byteLength) return #err("chunk sizes do not match resource byte length");

            switch (Sha256.contentRoot(byteLength, hashes, sizes)) {
                case null return #err("invalid content-root manifest");
                case (?actualRoot) {
                    if (not Blob.equal(actualRoot, contentRootHash)) return #err("content root mismatch");
                };
            };

            let resourceIndex = findResourceIndex(namespace, resourceId);
            switch (resourceIndex) {
                case null {};
                case (?index) {
                    if (sharing.resources[index].resourceType != resourceType) {
                        return #err("shared-resource type is immutable for a stable resource identity");
                    };
                };
            };
            let currentRevision : ?Nat = switch (resourceIndex) {
                case null null;
                case (?index) ?sharing.resources[index].currentRevision;
            };
            let revisionsMatch = switch (currentRevision, expectedRevision) {
                case (null, null) true;
                case (?current, ?expected) current == expected;
                case _ false;
            };
            if (not revisionsMatch) return #conflict(currentRevision);

            let nextRevision = switch (currentRevision) {
                case null 1;
                case (?current) current + 1;
            };
            let published : SharingMemory.Revision = {
                schemaVersion = SHARING_SCHEMA_VERSION;
                namespace;
                resourceId;
                resourceType;
                revision = nextRevision;
                byteLength;
                contentRootHash;
                chunks;
                snapshot;
                createdAt;
            };

            switch (resourceIndex) {
                case null {
                    let resource : SharingMemory.Resource = {
                        schemaVersion = SHARING_SCHEMA_VERSION;
                        namespace;
                        resourceId;
                        resourceType;
                        currentRevision = nextRevision;
                        createdAt;
                        updatedAt = createdAt;
                        revisions = [published];
                    };
                    sharing.resources := append<SharingMemory.Resource>(sharing.resources, resource);
                };
                case (?index) {
                    let current = sharing.resources[index];
                    let updated : SharingMemory.Resource = {
                        schemaVersion = current.schemaVersion;
                        namespace = current.namespace;
                        resourceId = current.resourceId;
                        resourceType = current.resourceType;
                        currentRevision = nextRevision;
                        createdAt = current.createdAt;
                        updatedAt = createdAt;
                        revisions = append<SharingMemory.Revision>(current.revisions, published);
                    };
                    sharing.resources := replaceAt<SharingMemory.Resource>(sharing.resources, index, updated);
                };
            };

            #ok(published);
        };
    };

/*---NEUTRON GENERATED BEGIN---*/

public type hello_world_Input = (name : Text);
public type hello_world_Output = Text;
public type sharing_schema_version_Input = ();
public type sharing_schema_version_Output = Nat;
public type sharing_has_chunk_Input = (hash : Blob);
public type sharing_has_chunk_Output = Bool;
public type sharing_put_chunk_Input = (hash : Blob, bytes : Blob);
public type sharing_put_chunk_Output = SharingPutChunkResult;
public type sharing_get_chunk_Input = (hash : Blob);
public type sharing_get_chunk_Output = ?Blob;
public type sharing_describe_Input = (namespace : Text, resourceId : Text);
public type sharing_describe_Output = ?SharingResourceSummary;
public type sharing_get_revision_Input = (namespace : Text, resourceId : Text, revision : ?Nat);
public type sharing_get_revision_Output = ?SharingRevision;
public type sharing_read_resource_chunk_Input = (namespace : Text, resourceId : Text, revision : Nat, chunkIndex : Nat);
public type sharing_read_resource_chunk_Output = ?Blob;
public type sharing_commit_revision_Input = (
    namespace : Text,
    resourceId : Text,
    resourceType : Text,
    expectedRevision : ?Nat,
    byteLength : Nat,
    contentRootHash : Blob,
    chunks : [SharingChunkRef],
    snapshot : SharingSnapshot,
    createdAt : Nat64,
);
public type sharing_commit_revision_Output = SharingCommitResult;

/*---NEUTRON GENERATED END---*/
}
