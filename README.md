# Sanctuary Benchmark

Sanctuary Benchmark is a small wrapper over [benchmarkjs][1] to enable a
consistent style of benchmarking across all Sanctuary projects. Allows for
the easy definition of comparative benchmarks, and outputs results in a
standardized format for sharing.

## Usage

Create a file in the bench directory, for example `old-vs-new.js`:

```javascript
const sb = require('sanctuary-benchmark');

// Imagine these are libs. Normally they would be require()'d.
const oldVersion = (f, xs) => xs.map(f);
const newVersion = (f, xs) => {
  const len = xs.length;
  const out = new Array(len);
  for (let idx = 0; idx < len; idx += 1) out[idx] = f(xs[idx]);
  return out;
};

const small = Array.from({length: 1}, (_, i) => i);
const large = Array.from({length: 1000}, (_, i) => i);

module.exports = sb(oldVersion, newVersion, {}, {
  'map/small': [{}, map => map(x => x + 1, small)],
  'map/large': [{}, map => map(x => x + 1, large)],
});
```

Run the sanctuary-benchmark command. Pass `--help` for options.

```sh
$ ./node_modules/.bin/sanctuary-benchmark
```

Alternatively, you can use the value now assigned to `module.exports`
programmatically. Consult the [API documentation](#api-documentation).

## Reading the output

Running the benchmarks will print a table to the terminal with the
following columns:

- `suite`: The name of the test suite
- `left`: The hertz and standard deviation measured for the number of
  rounds run for the library passed as first argument.
- `right`: The hertz and standard deviation measured for the number of
  rounds run for the library passed as second argument.
- `diff`: A percentage representing the difference between left and right,
  where 0 means "makes no difference" and 100 means "makes all the
  difference". You can use this number to tweak the significantDifference
  option, which determines whether a line will be highlighted.
- `change`: The increase or decrease from left to right. You can use this
  to show your friends how well you've optimized a feature.
- `α`: Wheter the difference is significant. Possible values are "✓" for
  an increase or "✗" for a decrease. Nothing will be rendered if the
  difference was insignificant.

## API Documentation

<h4 name="benchmark"><code><a href="https://github.com/sanctuary-js/sanctuary-benchmark/blob/v1.0.0/index.js#L114">benchmark :: (a, b, Options, StrMap (Spec a b)) -⁠> Options -⁠> Undefined</a></code></h4>

```haskell
Spec a b :: [Object, (a | b) -> Any]
          | [Object, a -> Any, b -> Any]

Options :: { callback :: Function?
             colors :: Boolean?
             config :: Object?
             leftHeader :: String?
             match :: String?
             rightHeader :: String?
             significantDifference :: Number? }
```

</details>

This module exports a single function. It takes four arguments and returns
another function. The four arguments are:

1. The left-hand benchmarking input: could be an older version of the
   library you're testing, or a competing library.
2. The right-hand benchmarking input: usually the current version of the
   library you're testing `require`d directly from the working directory.
3. An object containing defaults to the options passed in the next step.
   Refer to the documentation on the returned function to see what options
   are available.
4. A mapping of benchmarks where the keys represent the names, and the
   values describe the work we're benchmarking. The names can later be used
   to filter benchmarks by using a glob, so it's recommended to use the
   forward slash character as a separator, as shown in [usage](#usage).
   The value specifies the test. It's a Tuple with two or three items.
   The first item must always be an Object, and is used for per-test
   configuration overrides. The second and third items are the functions to
   run. When given a single function, it's used to test both libraries.
   When given two functions, they are used for the left and right library
   respectively.

Once these inputs are provided, a function is returned. The function will
run the benchmarks and print the results to StdOut when it is called. It
takes as input an object of options for the customization of this process:

- `callback` (`() => {})`): Called when the benchmarks have completed.
- `colors` (`true`): Set to `false` to disable terminal colors.
- `config` (`{}`): Default [Benchmark options][2] to use for every
  benchmark. These can be overridden per benchmark.
- `leftHeader` (`'left'`): Header describing the library on the left.
- `match` (`"**"`): This glob allows one to filter benchmarks by name.
- `rightHeader` (`'right'`): Header describing the library on the right.
- `significantDifference` (`0.1`): The resulting difference (between 0
  and 1) required for the output table to draw attention to these results.

[1]: https://benchmarkjs.com/
[2]: https://benchmarkjs.com/docs#options
