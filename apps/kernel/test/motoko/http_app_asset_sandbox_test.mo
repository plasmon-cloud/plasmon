import Kernel "../../backend/main";

// The response policy is an independent Kernel enforcement layer from the
// rendered iframe sandbox in workspace/app_tile_frame_policy.ts. Keep the two
// exact policies aligned, but test the backend header at its owning boundary.
assert (
    Kernel.appAssetSandboxHeaders(#opaque_app) == [
        ("Content-Security-Policy", "sandbox allow-scripts allow-downloads")
    ]
);
assert (Kernel.appAssetSandboxHeaders(#persistent_app).size() == 0);
assert (Kernel.appAssetSandboxHeaders(#deny).size() == 0);
assert (Kernel.appAssetSandboxHeaders(#kernel).size() == 0);
