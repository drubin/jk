# Using container images for packaging

## Summary

This RFC proposes

 - using a search path, rather than only looking in the script
   directory, for resolving modules (as requested in [#243][])
 - adding a flag for specifying a local path to put on the module
   search path
 - adding a flag for specifying a container image to put on the search
   path
 - automatically downloading and caching images that appear on the
   search path

The main implementation changes are:

 - allowing for an arbitrary set of module resolvers to be given to
   the VM
 - an image download and caching mechanism

The latter is orthogonal to its use for fetching modules, though this
is the only use for it so far.

## Example

```sh
$ jk validate -I ~/jklib --lib jkcfg/kubernetes:0.2.1 ./lint.js *.yaml
```

This adds `$HOME/jklib` and the filesystem in the image
`jkcfg/kubernetes:0.2.1` to the module search path, then runs the
validation function from `./lint.js` (which is assumed to import
modules from both locations) over the files given by the glob pattern.

`jk` will check if the image is already cached locally, and if not,
download it before running.

## Motivation

Presently, `jk` will resolve imports by looking in the filesystem
starting at the directory containing the script being run. This works
in sympathy with NPM, so long as you have a package.json describing
your dependencies.

However, there are some reasons to be dissatisfied with NPM, and some
reasons to explore using container images for packaging and
distribution. (See Alternatives for some more discussion of NPM).

The main kind of use case this addresses is how to arrange for
dependencies to be available along with code. For example, when using
`jk` with [Flux's manifest generation][flux-manifest], it's not enough
for the generation script to be present in the git repo -- it will
almost always need some libraries to be there as well.

There are a few ways to arrange this:

 - vendor the libraries (i.e., add them all to the git repo)
 - arrange for NPM to be present in the Flux container, and run it
   before running the script
 - no doubt variations on the above

But what is _not_ possible is to copy the files over from an
initContainer, or similar, because there's nowhere to put them that
module resolution will find them. Hence: let `jk` be given a module
search path.

Going a step further, it would be convenient to package modules in
container images for distribution, using the same machinery as already
use in place for containers.

_Explain here the motivation for the change -- what problem are people
facing that is difficult to solve with `jk` as it is?_

## Design

### Module search path

### User interface

    jk run --lib jkcfg/kubernetes:0.2.1 -I ../mycharts generate.js

The flag `-I` is chosen to be analogous to that used by C (and other?)
compilers. Using the same flag for images would allow ambiguities, so
it's better to have a spearate flag; `--lib` is put forward here as
small and guessable. (`--image` is an alternative, but that doesn't
indicate it's a _library_ rather than the thing to execute.)

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
$ docker build -t localhost:5000/mylib:0.1-pre .
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

One downside of using NPM is that it's understandably weighted towards
Node.JS. In practice it will work for resolving and downloading
packages for `jk`, but there's a bunch of cognitive baggage, like
irrelevant fields in `package.json`.

Another downside is that NPM packages are not architecture- or
OS-specific -- like Node.JS, they are platform-independent. For
plugins, and perhaps other purposes, `jk` will occasionally need to
ship multiple binaries. While it's possible to dispatch within the
runtime given a package with all the binaries, it'd be nicer to just
download a platform-specific package.

In its favour, NPM and its quirks are well known by now, and you can
just use the fields you need ('name' and 'dependencies' more or less),
and it'll work for most packages.

Using container images for packaging introduces some interesting
possibilities. Since an image is a set of layers with some metadata,
it's possible to construct a single image with all dependencies which
nonetheless shares structure (layers) with other images, and can
thereby be distributed efficiently.

It's also possible to make platform-specific images (that share
layers) to save people fetching redundant files.

However, there's no dependency resolution machinery, and it may be
difficult to co-opt that of NPM (if it were considered suitable).

So it comes down to: are the possibilities of using images
sufficiently interesting to try using them in the way detailed here,
with the prospect of building on that later. (Sure!)

### Specify images in imports rather than on the command line

In this RFC, an import in JavaScript is given as a symbolic name,
which is resolved to a location depending on the command-line flags
given to `jk` controlling the module search path.

Another way is to imply the location in the import statement itself
(like golang does). For example, instead of

```
import { chart } from '@jkcfg/kubernetes/helm';
```

use

```
import { chart } from 'oci:jkcfg/kubernetes/helm:0.5.2';
```

which gives the provenance of the imported module as being the image
`jkcfg/kubernetes/helm:0.5.2` (assuming that could be resolved to an
image repo somewhere). An advantage of this is that it make statically
determining the dependencies easier: you can in principle just take
the code, download the images involved, look at _those_ modules, etc.

There are reasons you might want to keep the indirection, though; most
dependency resolution tooling keeps the specifics in a separate file
(go.mod/go.sum; various lockfiles), and anything we do in `jk` is
likely to do the same. This RFC does not rule out being more explicit
about provenance in imports later.

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
