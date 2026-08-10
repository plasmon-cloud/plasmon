// Persistent schema v1. Keep this file immutable after release. Add a new
// sharing schema version and an explicit migration rather than editing v1.
module {
    public type Chunk = {
        hash : Blob;
        bytes : Blob;
    };

    public type ChunkRef = {
        hash : Blob;
        size : Nat;
    };

    public type AtomSnapshot = {
        format : Text;
        version : Nat;
        atomId : Text;
        handlerId : Text;
        atomType : Text;
        schemaVersion : Nat;
        title : ?Text;
    };

    public type Snapshot = {
        displayName : Text;
        kind : Text;
        mime : ?Text;
        atom : ?AtomSnapshot;
    };

    public type Revision = {
        schemaVersion : Nat;
        namespace : Text;
        resourceId : Text;
        resourceType : Text;
        revision : Nat;
        byteLength : Nat;
        contentRootHash : Blob;
        chunks : [ChunkRef];
        snapshot : Snapshot;
        createdAt : Nat64;
    };

    public type Resource = {
        schemaVersion : Nat;
        namespace : Text;
        resourceId : Text;
        resourceType : Text;
        currentRevision : Nat;
        createdAt : Nat64;
        updatedAt : Nat64;
        revisions : [Revision];
    };

    public type ResourceSummary = {
        schemaVersion : Nat;
        namespace : Text;
        resourceId : Text;
        resourceType : Text;
        currentRevision : Nat;
        createdAt : Nat64;
        updatedAt : Nat64;
    };

    public type PutChunkResult = {
        #stored;
        #deduplicated;
        #err : Text;
    };

    public type CommitResult = {
        #ok : Revision;
        #conflict : ?Nat;
        #err : Text;
    };

    public type Mem = {
        var schemaVersion : Nat;
        var chunks : [Chunk];
        var resources : [Resource];
    };

    public func init() : Mem {
        {
            var schemaVersion = 1;
            var chunks = [];
            var resources = [];
        };
    };
};
