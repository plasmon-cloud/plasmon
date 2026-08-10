# Third-party attribution — daedalOS

Plasmon native window interactions are behaviorally and substantially adapted from generic window-management patterns in:

- Repository: `DustinBrett/daedalOS`
- `components/system/Window/RndWindow/index.tsx`
- `components/system/Window/RndWindow/useRnd.ts`
- `components/system/Window/RndWindow/rndDefaults.ts`

Adapted concepts include resize edge/corner hit zones and cursors, rerouting focus from interaction handles, disabling iframe pointer interception during drag/resize, and committing bounded geometry after interaction. Plasmon does not import daedalOS process architecture or filesystem code and does not depend on `react-rnd`.

Upstream license notice:

> MIT License
>
> Copyright (c) 2025 Dustin Brett
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
