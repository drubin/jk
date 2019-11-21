# Using image registries for distribution

^^^ not quite! revisit

## Summary

_Write here a summary of the intended change to `jk`. Include the
principle benefit of adopting and implementing the proposal, and an
outline of technical changes needed._

Presently, `jk` will resolve imports by looking in the filesystem
starting at the directory containing the script being run. This works
in sympathy with NPM, so long as you have a package.json describing
your dependencies.

This RFC proposes

 - using a search path, rather than only looking in the script
   directory, for resolving modules (as requested in [#243][])
   - adding a flag for specifying a local path to put on the module
     search path
   - adding a flag for specifying a container image to put on the search
     path
 - automatically downloading and caching images that appear on the
   search path

## Example

_Include here a brief, illustrative example of using `jk` with the
proposed change._

```sh
$ jk validate -I ~/jklib -I jkcfg/kubernetes:0.2.1 ./lint.js *.yaml
```

This adds `$HOME/jklib` and the image `jkcfg/kubernetes:0.2.1` to the
module search path, then runs the validation function from `./lint.js`
(which imports modules from both) over the files given by the glob
pattern.

`jk` will check if the image is already cached locally, and if not,
download it before running.

## Motivation

_Explain here the motivation for the change -- what problem are people
facing that is difficult to solve with `jk` as it is?_

## Design

### Module search path

### User interface

    jk run -I @jkcfg/kubernetes:0.2.1 -I ../mycharts generate.js

The flag `-I` is chosen to be analogous to that used by C (and other?)
compilers.

_Describe here the design of the change._

 - _What is the user interface or API? Give examples if you can._
 - _How will it work, technically?_
 _ _What are the corner cases, and how are they covered?_

### Downloading, caching, unpacking images

https://github.com/opencontainers/image-tools has code for unpacking
an image. https://github.com/containers/skopeo has code for fetching
and converting between image formats.

### Layout of images

Container images include a whole filesystem. Where should `jk` look
for modules?

 * will want image layers to compose so they can be remoxed, so it
   makes sense to put modules in the same place every time
 * e.g., just chuck everything under `/node_modules`, that way if you
   jam a bunch of layers together in an image, it'll just look like an
   NPM directory

#### Building images

Although this RFC is not about tooling for building images, it's worth
mentioning here how one would go about it.

Using a Dockerfile, you can make an archive of your current
node_modules contents:

```
$ cat > Dockerfile <<EOF
FROM scratch
WORKINGDIR /node_modules
COPY node_modules ./
EOF
$ docker build -t localhost:5000/jklib .
```

It is also desirable to be able to combine libraries -- this is an
assumed benefit of using image layers. But that is outside the
capability of `docker build`.

## Backward compatibility

_Enumerate any backward-compatibility concerns:_

 - _Will people have to change their existing code?_
 - _If they don't, what might happen?_

_If the change will be backward-compatible, explain why._

## Drawbacks and limitations

_What are the drawbacks of adopting this proposal; e.g.,_

 - _Does it require more engineering work from users (for an
   equivalent result)?_
 - _Are there performance concerns?_
 - _Will it close off other possibilities?_
 - _Does it add significant complexity to the runtime or standard library?_
 - _Does it make understanding `jk` harder?_

## Alternatives

_Explain other designs or formulations that were considered (including
doing nothing, if not already covered above), and why the proposed
design is superior._

### Stick with NPM

An obvious question is "Why not just bless NPM as the way to
distribute libraries for jk?".

### Use "OCI distribution" and own format

Like Helm 3 does. (It's not ready yet; only supported by ACR and
registry:2)

https://github.com/deislabs/oras

## Unresolved questions

_Keep track here of questions that come up while this is a draft.
Ideally, there will be nothing unresolved by the time the RFC is
accepted. It is OK to resolve a question by explaining why it
does not need to be answered_ yet _._

 - tags vs checksums/digests

It's possible for the image that a ref points at to change. What
should we do in that circumstance (will we even notice? once it's
downloaded, we don;t check again). This could be punted by letting
people update the cached images explicitly, and/or reporting when the
digest has changed. A go.sum-style file might be used to make things
repeatable. Or a digest given in the image name (but then .. so much
text .. maybe getting the search path from a file would be useful).

[#243]: https://github.com/jkcfg/jk/issues/243
