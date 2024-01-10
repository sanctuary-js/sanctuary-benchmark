import assert from 'assert';

import intercept from 'intercept-stdout';
import show from 'sanctuary-show';
import Z from 'sanctuary-type-classes';

import createRunner from '../index.js';


function eq(actual, expected) {
  assert.strictEqual (arguments.length, eq.length);
  assert.strictEqual (show (actual), show (expected));
  assert.strictEqual (Z.equals (actual, expected), true);
}

const expectOutput = expectations => {
  let idx = 0;
  const unhook = intercept (text => {
    (text.split ('\n')).forEach (line => {
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
  return () => {
    unhook ();
    if (idx < expectations.length - 1) {
      throw new Error (
        `Expected ${expectations.length - idx} more lines to be printed.`
      );
    }
  };
};

test ('createRunner', () => {
  eq (typeof createRunner, 'function');
  eq (createRunner.length, 4);
  eq (typeof createRunner ({}, {}, {}, {}), 'function');
  eq ((createRunner ({}, {}, {}, {})).length, 1);
});

{

  const options = {
    colors: true,
    config: {minSamples: 1},
    leftHeader: 'custom left',
    match: 'mock/*',
    rightHeader: 'custom right',
    significantDifference: 0,
  };

  const fastLib = () => {};

  const slowLib = () => {
    const theFuture = Date.now () + 1;
    while (Date.now () < theFuture) {}
  };

  const benchmark = [{}, lib => { lib (); }];

  const spec = {
    'mock/first': benchmark,
    'mock/second': benchmark,
    'fake/third': benchmark,
  };

  const expectResult = resultLine => (
    expectOutput ([
      /^# 1[/]2: mock[/]first *\r$/,
      /^# 2[/]2: mock[/]second *\r$/,
      /^.*$/,
      /custom/,
      /^.*$/,
      resultLine,
      /^.*$/,
      resultLine,
      /^.*$/,
      /^$/,
    ])
  );

  const T = '\u001b\\[90m│\u001b\\[39m';

  test ('standard use: faster', done => {
    const run = createRunner (slowLib, fastLib, {}, spec);
    const assertFaster = expectResult (new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9]{3}[.][0-9]% +' +
      T + ' \u001b\\[32m[+][0-9]+[.][0-9]%\u001b\\[0m +' +
      T + ' \u001b\\[32m✓\u001b\\[0m ' + T +
      '$'
    ));

    run (Object.assign ({callback: () => {
      assertFaster ();
      done ();
    }}, options));
  });

  test ('standard use: slower', done => {
    const run = createRunner (fastLib, slowLib, {}, spec);
    const assertSlower = expectResult (new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9]{3}[.][0-9]% +' +
      T + ' \u001b\\[31m-[0-9]+[.][0-9]%\u001b\\[0m +' +
      T + ' \u001b\\[31m✗\u001b\\[0m ' + T +
      '$'
    ));

    run (Object.assign ({callback: () => {
      assertSlower ();
      done ();
    }}, options));
  });

}


test ('split runner syntax', done => {
  const options = {
    callback: done,
    colors: false,
    config: {
      minSamples: 1,
      onError: done,
    },
    significantDifference: 0,
  };

  const left = {left: true};
  const right = {right: true};

  const spec = {
    mock: [{},
           lib => { eq (lib, left); },
           lib => { eq (lib, right); }],
  };

  const run = createRunner (left, right, {}, spec);

  run (options);
});

test ('no matches', () => {
  const options = {
    match: 'this will match nothing',
  };

  const spec = {
    'this will not be matched': [{}, () => {}],
  };

  const run = createRunner ({}, {}, {}, spec);
  const assert = expectOutput ([/^No benchmarks matched$/, /^$/]);

  run (options);
  assert ();
});

test ('no significant difference', done => {
  const spec = {mock: [{}, () => {}]};
  const run = createRunner ({}, {}, {}, spec);
  const assert = expectOutput ([
    /^# 1[/]1: mock *\r$/,
    /^┌[─┬]+┐$/,
    /^│ suite +│ left +│ right +│ diff +│ change +│ α │$/,
    /^├[─┼]+┤$/,
    /^│ mock +│(?: [\d,]+ Hz ±\d+[.]\d+% \(n \d+\) +│){2} \d{3}[.]\d% +│ [-+]\d+[.]\d% +│ {3}│$/,
    /^└[─┴]+┘$/,
    /^$/,
  ]);

  const options = {
    callback: () => {
      assert ();
      done ();
    },
    colors: false,
    config: {
      minSamples: 1,
      onError: done,
    },
    significantDifference: 100,
  };

  run (options);
});

test ('arguments', done => {
  const options = {
    callback: done,
    config: {
      defer: true,
      onError: done,
    },
  };

  const spec = {
    assert: [{}, (lib, args) => {
      eq (typeof args, 'object');
      eq (args == null, false);
      eq (typeof args[0], 'object');
      eq (args[0] == null, false);
      eq (typeof args[0].resolve, 'function');
      setImmediate (() => {
        args[0].resolve ();
      });
    }],
  };

  const run = createRunner ({}, {}, null, spec);

  run (options);
});
