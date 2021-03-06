import { walk } from '@jkcfg/std/fs';
import { print } from '@jkcfg/std';

// The files and directories in fs-walk-preorder-files are designed to
// be in alphabetical order, when traversed in preorder.

for (const f of walk('./fs-walk-preorder-files')) {
  if (!f.name.startsWith('.')) print(f.name);
}
