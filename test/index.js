import {deepStrictEqual as eq} from 'node:assert';

import intercept from 'intercept-stdout';
import test from 'oletus';

import createRunner from '../index.js';


const executeRunner = (runner, options = {}) => new Promise ((res, rej) => {
  runner ({
    ...options,
    callback: res,
    config: {...options.config, onError: rej},
  });
});

const expectOutput = (expectations, run) => new Promise ((res, rej) => {
  let idx = 0;
  const unhook = intercept (text => {
    (text.split ('\n')).forEach (line => {
      if (idx >= expectations.length) {
        unhook ();
        rej (new Error (
          'More lines than expected were printed:\n\n' +
          JSON.stringify (line)
        ));
      }
      if (expectations[idx].test (line) === false) {
        unhook ();
        rej (new Error (
          'A printed line did not meet expectations:\n\n' +
          JSON.stringify (line) + '\n\n' +
          'It does not match expression:\n\n' +
          expectations[idx].toString ()
        ));
      }
      idx += 1;
    });
  });

  run ()
  .finally (unhook)
  .then (() => {
    if (idx < expectations.length - 1) {
      throw new Error (
        `Expected ${expectations.length - idx} more lines to be printed.`
      );
    }
  })
  .then (res, rej);
});

await test ('createRunner', () => {
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

  const expectResult = (resultLine, run) => (
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
    ], run)
  );

  const T = '\u001b\\[90m│\u001b\\[39m';

  await test ('standard use: faster', () => expectResult (
    new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9]{3}[.][0-9]% +' +
      T + ' \u001b\\[32m[+][0-9]+[.][0-9]%\u001b\\[0m +' +
      T + ' \u001b\\[32m✓\u001b\\[0m ' + T +
      '$'
    ),
    () => executeRunner (createRunner (slowLib, fastLib, {}, spec), options)
  ));

  await test ('standard use: slower', () => expectResult (
    new RegExp (
      '^' +
      T + ' mock/(first|second) +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9,]+ Hz ±[0-9]+[.][0-9]+% [(]n [0-9]+[)] +' +
      T + ' [0-9]{3}[.][0-9]% +' +
      T + ' \u001b\\[31m-[0-9]+[.][0-9]%\u001b\\[0m +' +
      T + ' \u001b\\[31m✗\u001b\\[0m ' + T +
      '$'
    ),
    () => executeRunner (createRunner (fastLib, slowLib, {}, spec), options)
  ));

}


await test ('split runner syntax', () => {
  const left = {left: true};
  const right = {right: true};

  const spec = {
    mock: [{},
           lib => { eq (lib, left); },
           lib => { eq (lib, right); }],
  };

  return executeRunner (createRunner (left, right, {}, spec), {
    colors: false,
    config: {minSamples: 1},
    significantDifference: 0,
  });
});

await test ('no matches', async () => expectOutput (
  [/^No benchmarks matched$/, /^$/],
  () => {
    const options = {
      match: 'this will match nothing',
    };

    const spec = {
      'this will not be matched': [{}, () => {}],
    };

    const run = createRunner ({}, {}, {}, spec);

    return executeRunner (run, options);
  }
));

await test ('no significant difference', () => expectOutput (
  [
    /^# 1[/]1: mock *\r$/,
    /^┌[─┬]+┐$/,
    /^│ suite +│ left +│ right +│ diff +│ change +│ α │$/,
    /^├[─┼]+┤$/,
    /^│ mock +│(?: [\d,]+ Hz ±\d+[.]\d+% \(n \d+\) +│){2} \d{3}[.]\d% +│ [-+]\d+[.]\d% +│ {3}│$/,
    /^└[─┴]+┘$/,
    /^$/,
  ],
  () => {
    const spec = {mock: [{}, () => {}]};
    const run = createRunner ({}, {}, {}, spec);

    const options = {
      colors: false,
      config: {minSamples: 1},
      significantDifference: 100,
    };

    return executeRunner (run, options);
  }
));

await test ('arguments', () => {
  const options = {
    config: {defer: true},
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

  executeRunner (run, options);
});
