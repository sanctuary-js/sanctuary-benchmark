//. # Sanctuary Benchmark
//.
//. Sanctuary Benchmark is a small wrapper over [benchmarkjs][1] to enable a
//. consistent style of benchmarking across all Sanctuary projects. Allows for
//. the easy definition of comparative benchmarks, and outputs results in a
//. standardized format for sharing.
//.
//. ## Usage
//.
//. Create a file in the bench directory, for example `old-vs-new.js`:
//.
//. ```javascript
//. const sb = require('sanctuary-benchmark');
//.
//. // Imagine these are libs. Normally they would be require()'d.
//. const oldVersion = (f, xs) => xs.map(f);
//. const newVersion = (f, xs) => {
//.   const len = xs.length;
//.   const out = new Array(len);
//.   for (let idx = 0; idx < len; idx += 1) out[idx] = f(xs[idx]);
//.   return out;
//. };
//.
//. const small = Array.from({length: 1}, (_, i) => i);
//. const large = Array.from({length: 1000}, (_, i) => i);
//.
//. module.exports = sb(oldVersion, newVersion, {}, {
//.   'map/small': [{}, map => map(x => x + 1, small)],
//.   'map/large': [{}, map => map(x => x + 1, large)],
//. });
//. ```
//.
//. Run the sanctuary-benchmark command. Pass `--help` for options.
//.
//. ```sh
//. $ ./node_modules/.bin/sanctuary-benchmark
//. ```
//.
//. Alternatively, you can use the value now assigned to `module.exports`
//. programmatically. Consult the [API documentation](#api-documentation).
//.
//. ## Reading the output
//.
//. Running the benchmarks will print a table to the terminal with the
//. following columns:
//.
//. - `suite`: The name of the test suite
//. - `left`: The hertz and standard deviation measured for the number of
//.   rounds run for the library passed as first argument.
//. - `right`: The hertz and standard deviation measured for the number of
//.   rounds run for the library passed as second argument.
//. - `diff`: A percentage representing the difference between left and right,
//.   where 0 means "makes no difference" and 100 means "makes all the
//.   difference". You can use this number to tweak the significantDifference
//.   option, which determines whether a line will be highlighted.
//. - `change`: The increase or decrease from left to right. You can use this
//.   to show your friends how well you've optimized a feature.
//. - `α`: Wheter the difference is significant. Possible values are "✓" for
//.   an increase or "✗" for a decrease. Nothing will be rendered if the
//.   difference was insignificant.
'use strict';

var Suite = require('benchmark').Suite;
var Table = require('cli-table2');
var micromatch = require('micromatch');


//       formatPct :: (Boolean, Number) -> String
function formatPct(sign, pct) {
  var rendered = (sign ? pct : Math.abs(pct)).toLocaleString('en', {
    minimumIntegerDigits: 3,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false
  });
  return (sign && pct >= 0 ? '+' + rendered : rendered) + '%';
}

//       format :: BenchmarkResult -> String
function format(res) {
  return res.hz.toLocaleString('en', {maximumFractionDigits: 0}) + ' Hz '
       + '±' + res.stats.rme.toFixed(2) + '% '
       + '(n ' + String(res.stats.sample.length) + ')';
}

//       get :: (String, a, Any) -> a
function get(key, fallback, x) {
  var o = Object(x);
  return typeof o[key] === typeof fallback ? o[key] : fallback;
}

//       green :: String -> String
function green(s) {
  return '\u001B[32m' + s + '\u001B[0m';
}

//       identity :: a -> a
function identity(x) {
  return x;
}

//       red :: String -> String
function red(s) {
  return '\u001B[31m' + s + '\u001B[0m';
}

//       repeat :: (Number, String) -> String
function repeat(n, s) {
  return new Array(n + 1).join(s);
}

//. ## API Documentation

//# benchmark :: (a, b, Options, StrMap (Spec a b)) -> Options -> Undefined
//.
//. ```haskell
//. Spec a b :: [Object, (a | b) -> Any]
//.           | [Object, a -> Any, b -> Any]
//.
//. Options :: { callback :: Function?
//.              colors :: Boolean?
//.              config :: Object?
//.              leftHeader :: String?
//.              match :: String?
//.              rightHeader :: String?
//.              significantDifference :: Number? }
//. ```
//.
//. </details>
//.
//. This module exports a single function. It takes four arguments and returns
//. another function. The four arguments are:
//.
//. 1. The left-hand benchmarking input: could be an older version of the
//.    library you're testing, or a competing library.
//. 2. The right-hand benchmarking input: usually the current version of the
//.    library you're testing `require`d directly from the working directory.
//. 3. An object containing defaults to the options passed in the next step.
//.    Refer to the documentation on the returned function to see what options
//.    are available.
//. 4. A mapping of benchmarks where the keys represent the names, and the
//.    values describe the work we're benchmarking. The names can later be used
//.    to filter benchmarks by using a glob, so it's recommended to use the
//.    forward slash character as a separator, as shown in [usage](#usage).
//.    The value specifies the test. It's a Tuple with two or three items.
//.    The first item must always be an Object, and is used for per-test
//.    configuration overrides. The second and third items are the functions to
//.    run. When given a single function, it's used to test both libraries.
//.    When given two functions, they are used for the left and right library
//.    respectively.
//.
//. Once these inputs are provided, a function is returned. The function will
//. run the benchmarks and print the results to StdOut when it is called. It
//. takes as input an object of options for the customization of this process:
//.
//. - `callback` (`() => {})`): Called when the benchmarks have completed.
//. - `colors` (`true`): Set to `false` to disable terminal colors.
//. - `config` (`{}`): Default [Benchmark options][2] to use for every
//.   benchmark. These can be overridden per benchmark.
//. - `leftHeader` (`'left'`): Header describing the library on the left.
//. - `match` (`"**"`): This glob allows one to filter benchmarks by name.
//. - `rightHeader` (`'right'`): Header describing the library on the right.
//. - `significantDifference` (`0.1`): The resulting difference (between 0
//.   and 1) required for the output table to draw attention to these results.
module.exports = function benchmark(leftLib, rightLib, options, specs) {
  var _callback = get('callback', function() {}, options);
  var _colors = get('colors', true, options);
  var _config = get('config', {}, options);
  var _leftHeader = get('leftHeader', 'left', options);
  var _match = get('match', '**', options);
  var _rightHeader = get('rightHeader', 'right', options);
  var _significantDifference = get('significantDifference', 0.1, options);

  return function runBenchmarks(overrides) {
    var callback = get('callback', _callback, overrides);
    var colors = get('colors', _colors, overrides);
    var config = get('config', _config, overrides);
    var leftHeader = get('leftHeader', _leftHeader, overrides);
    var match = get('match', _match, overrides);
    var rightHeader = get('rightHeader', _rightHeader, overrides);
    var significantDifference = get('significantDifference',
                                    _significantDifference,
                                    overrides);

    var table = new Table({
      head: ['suite', leftHeader, rightHeader, 'diff', 'change', 'α'],
      style: colors ? {} : {border: [], head: []}
    });

    var keys = Object.keys(specs).filter(micromatch.matcher(match));

    if (keys.length === 0) {
      process.stdout.write('No benchmarks matched\n');
      callback();
      return;
    }

    var completed = 0;

    function runSpec(i) {
      var name = keys[i];
      var output = '# ' + String(i + 1) +
                   '/' + String(keys.length) +
                   ': ' +  name;

      var padding = process.stdout.getWindowSize()[0] - output.length;

      process.stdout.write(output + repeat(Math.max(padding, 0), ' ') + '\r');

      var suite = new Suite(name);
      var spec = specs[name];
      var left = spec[1];
      var right = spec[spec.length - 1];

      suite.add('left', Object.assign({}, config, spec[0], {
        fn: function() { left(leftLib, arguments); }
      }));

      suite.add('right', Object.assign({}, config, spec[0], {
        fn: function() { right(rightLib, arguments); }
      }));

      suite.on('complete', function() {
        var oldRes = this[0], newRes = this[1];
        var change = (newRes.hz - oldRes.hz) / oldRes.hz;
        var difference = Math.abs((newRes.hz - oldRes.hz) /
                                  ((oldRes.hz + newRes.hz) / 2) /
                                  2);
        var isPositive = difference > significantDifference && change > 0;
        var isNegative = difference > significantDifference && change < 0;

        var highlight = colors && isPositive ? green :
                        colors && isNegative ? red :
                        identity;

        table.push([name,
                    format(oldRes),
                    format(newRes),
                    formatPct(false, difference * 100),
                    highlight(formatPct(true, change * 100)),
                    highlight(isPositive ? '✓' : isNegative ? '✗' : '')]);

        completed += 1;

        if (completed === keys.length) {
          process.stdout.write(table.toString() + '\n');
          callback();
        } else {
          runSpec(i + 1);
        }
      });

      suite.run({async: true});
    }

    runSpec(0);

  };

};

//. [1]: https://benchmarkjs.com/
//. [2]: https://benchmarkjs.com/docs#options
