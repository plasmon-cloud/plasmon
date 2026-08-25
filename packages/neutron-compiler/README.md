# Neutron compiler

`neutron-compiler` decodes validated `.neutron` archives, plans installation, assembles the complete actor, prepares certified assets, and supplies checked install helpers. It is shared by package/release and in-product installation paths but does not own workspace discovery or deployment supervision.

Compiler behavior is contract-heavy: package manifests, capability plans, managed memory, app dependencies, certified assets, and installation transactions are validated by the package's tests and the canonical documents under [`../../doc/`](../../doc/).
