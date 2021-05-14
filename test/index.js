'use strict';

var assert = require ('assert');

var intercept = require ('intercept-stdout');
var show = require ('sanctuary-show');
var Z = require ('sanctuary-type-classes');

var createRunner = require ('..');


function eq(actual, expected) {
  assert.strictEqual (arguments.length, eq.length);
  assert.strictEqual (show (actual), show (expected));
  assert.strictEqual (Z.equals (actual, expected), true);
}

function expectOutput(expectations) {
  var idx = 0;
  var unhook = intercept (function(text) {
    (text.split ('\n')).forEach (function(line) {
      if (idx >= expectations.length) {
        unhook ();
        throw new Error (
          'More lines than expected were printed:\n\n' +
          JSON.stringify (line)
        );
      }
      if (expectations[idx].test (line) === false) {
        unhook ();
        throw new Error (
          'A printed line did not meet expectations:\n\n' +
          JSON.stringify (line) + '\n\n' +
          'It does not match expression:\n\n' +
          expectations[idx].toString ()
        );
      }
      idx += 1;
    });
  });
  return function() {
    unhook ();
    if (idx < expectations.length - 1) {
      throw new Error (
        'Expected ' +
        String (expectations.length - idx) +
        ' more lines to be printed.'
      );
    }
  };
}

test ('createRunner', function() {
  eq (typeof createRunner, 'function');
  eq (createRunner.length, 4);
  eq (typeof createRunner ({}, {}, {}, {}), 'function');
  eq ((createRunner ({}, {}, {}, {})).length, 1);
});

(function() {

  var options = {
    colors: true,
    config: {minSamples: 1},
    leftHeader: 'custom left',
    match: 'mock/*',
    rightHeader: 'custom right',
    significantDifference: 0
  };

  function fastLib() {}

  function slowLib() {
    var theFuture = Date.now () + 1;
    while (Date.now () < theFuture) {}
  }

  var benchmark = [{}, function(lib) { lib (); }];

  var spec = {
    'mock/first': benchmark,
    'mock/second': benchmark,
    'fake/third': benchmark
  };

  function expectResult(resultLine) {
    return expectOutput ([
      /^# 1[/]2: mock[/]first *\r$/,
      /^# 2[/]2: mock[/]second *\r$/,
      /^.*$/,
      /custom/,
      /^.*$/,
      resultLine,
      /^.*$/,
      resultLine,
      /^.*$/,
      /^$/
    ]);
  }

  var T = '\\u001b\\[90m│\\u001b\\[39m';

  test ('standard use: faster', function(done) {
    var run = createRunner (slowLib, fastLib, {}, spec);
    var assertFaster = expectResult (new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [\\d,]+ Hz ±\\d+[.]\\d+% \\(n \\d+\\) +' +
      T + ' [\\d,]+ Hz ±\\d+[.]\\d+% \\(n \\d+\\) +' +
      T + ' \\d{3}[.]\\d% +' +
      T + ' \\u001b\\[32m[+]\\d+[.]\\d%\\u001b\\[0m +' +
      T + ' \\u001b\\[32m✓\\u001b\\[0m ' + T +
      '$'
    ));

    run (Object.assign ({callback: function() {
      assertFaster ();
      done ();
    }}, options));
  });

  test ('standard use: slower', function(done) {
    var run = createRunner (fastLib, slowLib, {}, spec);
    var assertSlower = expectResult (new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [\\d,]+ Hz ±\\d+[.]\\d+% \\(n \\d+\\) +' +
      T + ' [\\d,]+ Hz ±\\d+[.]\\d+% \\(n \\d+\\) +' +
      T + ' \\d{3}[.]\\d% +' +
      T + ' \\u001b\\[31m-\\d+[.]\\d%\\u001b\\[0m +' +
      T + ' \\u001b\\[31m✗\\u001b\\[0m ' + T +
      '$'
    ));

    run (Object.assign ({callback: function() {
      assertSlower ();
      done ();
    }}, options));
  });

} ());


test ('split runner syntax', function(done) {
  var options = {
    callback: done,
    colors: false,
    config: {
      minSamples: 1,
      onError: done
    },
    significantDifference: 0
  };

  var left = {left: true};
  var right = {right: true};

  var spec = {
    mock: [{},
           function(lib) { eq (lib, left); },
           function(lib) { eq (lib, right); }]
  };

  var run = createRunner (left, right, {}, spec);

  run (options);
});

test ('no matches', function() {
  var options = {
    match: 'this will match nothing'
  };

  var spec = {
    'this will not be matched': [{}, function() { }]
  };

  var run = createRunner ({}, {}, {}, spec);
  var assert = expectOutput ([/^No benchmarks matched$/, /^$/]);

  run (options);
  assert ();
});

test ('no significant difference', function(done) {
  var spec = {mock: [{}, function() {}]};
  var run = createRunner ({}, {}, {}, spec);
  var assert = expectOutput ([
    /^# 1[/]1: mock *\r$/,
    /^┌[─┬]+┐$/,
    /^│ suite +│ left +│ right +│ diff +│ change +│ α │$/,
    /^├[─┼]+┤$/,
    /^│ mock +│(?: [\d,]+ Hz ±\d+[.]\d+% \(n \d+\) +│){2} \d{3}[.]\d% +│ [-+]\d+[.]\d% +│ {3}│$/,
    /^└[─┴]+┘$/,
    /^$/
  ]);

  var options = {
    callback: function() {
      assert ();
      done ();
    },
    colors: false,
    config: {
      minSamples: 1,
      onError: done
    },
    significantDifference: 100
  };

  run (options);
});

test ('arguments', function(done) {
  var options = {
    callback: done,
    config: {
      defer: true,
      onError: done
    }
  };

  var spec = {
    assert: [{}, function(lib, args) {
      eq (typeof args, 'object');
      eq (args == null, false);
      eq (typeof args[0], 'object');
      eq (args[0] == null, false);
      eq (typeof args[0].resolve, 'function');
      setImmediate (function() {
        args[0].resolve ();
      });
    }]
  };

  var run = createRunner ({}, {}, null, spec);

  run (options);
});
