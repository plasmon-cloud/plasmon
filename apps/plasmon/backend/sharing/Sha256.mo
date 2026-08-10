import Blob "mo:core/Blob";
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";
import VarArray "mo:core/VarArray";

module {
    let K : [Nat32] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let ROOT_DOMAIN : Blob = "plasmon.shared-resource.content-root.v1\00";

    func rotateRight(value : Nat32, bits : Nat32) : Nat32 {
        value <>> bits;
    };

    func writeWord(output : [var Nat8], offset : Nat, value : Nat32) {
        output[offset] := Nat8.fromNat(Nat32.toNat(value >> 24) % 256);
        output[offset + 1] := Nat8.fromNat(Nat32.toNat(value >> 16) % 256);
        output[offset + 2] := Nat8.fromNat(Nat32.toNat(value >> 8) % 256);
        output[offset + 3] := Nat8.fromNat(Nat32.toNat(value) % 256);
    };

    public func digest(input : Blob) : Blob {
        let source = Blob.toArray(input);
        let bitLength = source.size() * 8;
        let paddedLength = ((source.size() + 9 + 63) / 64) * 64;
        let padded = VarArray.repeat<Nat8>(0, paddedLength);

        var sourceIndex = 0;
        while (sourceIndex < source.size()) {
            padded[sourceIndex] := source[sourceIndex];
            sourceIndex += 1;
        };
        padded[source.size()] := 0x80;

        var remainingBits = bitLength;
        var lengthIndex = 0;
        while (lengthIndex < 8) {
            padded[paddedLength - 1 - lengthIndex] := Nat8.fromNat(remainingBits % 256);
            remainingBits /= 256;
            lengthIndex += 1;
        };

        var h0 : Nat32 = 0x6a09e667;
        var h1 : Nat32 = 0xbb67ae85;
        var h2 : Nat32 = 0x3c6ef372;
        var h3 : Nat32 = 0xa54ff53a;
        var h4 : Nat32 = 0x510e527f;
        var h5 : Nat32 = 0x9b05688c;
        var h6 : Nat32 = 0x1f83d9ab;
        var h7 : Nat32 = 0x5be0cd19;

        var blockOffset = 0;
        while (blockOffset < paddedLength) {
            let words = VarArray.repeat<Nat32>(0, 64);
            var i = 0;
            while (i < 16) {
                let offset = blockOffset + i * 4;
                words[i] :=
                    (Nat32.fromNat(Nat8.toNat(padded[offset])) << 24) |
                    (Nat32.fromNat(Nat8.toNat(padded[offset + 1])) << 16) |
                    (Nat32.fromNat(Nat8.toNat(padded[offset + 2])) << 8) |
                    Nat32.fromNat(Nat8.toNat(padded[offset + 3]));
                i += 1;
            };
            while (i < 64) {
                let x = words[i - 15];
                let y = words[i - 2];
                let s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >> 3);
                let s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >> 10);
                words[i] := words[i - 16] +% s0 +% words[i - 7] +% s1;
                i += 1;
            };

            var a = h0;
            var b = h1;
            var c = h2;
            var d = h3;
            var e = h4;
            var f = h5;
            var g = h6;
            var h = h7;

            i := 0;
            while (i < 64) {
                let s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
                let choose = (e & f) ^ ((e ^ 0xffffffff) & g);
                let temp1 = h +% s1 +% choose +% K[i] +% words[i];
                let s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
                let majority = (a & b) ^ (a & c) ^ (b & c);
                let temp2 = s0 +% majority;

                h := g;
                g := f;
                f := e;
                e := d +% temp1;
                d := c;
                c := b;
                b := a;
                a := temp1 +% temp2;
                i += 1;
            };

            h0 := h0 +% a;
            h1 := h1 +% b;
            h2 := h2 +% c;
            h3 := h3 +% d;
            h4 := h4 +% e;
            h5 := h5 +% f;
            h6 := h6 +% g;
            h7 := h7 +% h;
            blockOffset += 64;
        };

        let output = VarArray.repeat<Nat8>(0, 32);
        writeWord(output, 0, h0);
        writeWord(output, 4, h1);
        writeWord(output, 8, h2);
        writeWord(output, 12, h3);
        writeWord(output, 16, h4);
        writeWord(output, 20, h5);
        writeWord(output, 24, h6);
        writeWord(output, 28, h7);
        Blob.fromVarArray(output);
    };

    func writeNat64(output : [var Nat8], offset : Nat, value : Nat) {
        var remaining = value;
        var index = 0;
        while (index < 8) {
            output[offset + 7 - index] := Nat8.fromNat(remaining % 256);
            remaining /= 256;
            index += 1;
        };
    };

    public func contentRoot(byteLength : Nat, hashes : [Blob], sizes : [Nat]) : ?Blob {
        if (hashes.size() != sizes.size()) return null;
        let domain = Blob.toArray(ROOT_DOMAIN);
        let entrySize = 40;
        let preimage = VarArray.repeat<Nat8>(0, domain.size() + 16 + hashes.size() * entrySize);

        var offset = 0;
        var i = 0;
        while (i < domain.size()) {
            preimage[offset] := domain[i];
            offset += 1;
            i += 1;
        };
        writeNat64(preimage, offset, byteLength);
        offset += 8;
        writeNat64(preimage, offset, hashes.size());
        offset += 8;

        i := 0;
        while (i < hashes.size()) {
            let hash = Blob.toArray(hashes[i]);
            if (hash.size() != 32) return null;
            var hashIndex = 0;
            while (hashIndex < hash.size()) {
                preimage[offset] := hash[hashIndex];
                offset += 1;
                hashIndex += 1;
            };
            writeNat64(preimage, offset, sizes[i]);
            offset += 8;
            i += 1;
        };

        ?digest(Blob.fromVarArray(preimage));
    };
};
