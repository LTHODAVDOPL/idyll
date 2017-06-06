const path = require('path');
const fs = require('fs');
const browserifyInc = require('browserify-incremental');
const babelify = require('babelify');
const reactPreset = require('babel-preset-react');
const es2015Preset = require('babel-preset-es2015');
const brfs = require('brfs');
const Promise = require('bluebird');
const stream = require('stream');

let b;

const toStream = (str) => {
  const s = new stream.Readable;
  s.push(str);
  s.push(null);

  return s;
};

const getTransform = (opts) => {
  const _getTransform = (name) => {
    return (opts[name] || []).map(d => require(d));
  };

  return [[ babelify, { presets: [ reactPreset, es2015Preset ], babelrc: false } ]]
    .concat(_getTransform('transform'))
    .concat([[ brfs ]]);
};

module.exports = function (opts, paths, output) {
  process.env['NODE_ENV'] = opts.watch ? 'development' : 'production';

  if (!b) {
    const config = {
      entries: [path.join(__dirname, '..', 'client', 'build.js')],
      cache: {},
      packageCache: {},
      fullPaths: true,
      cacheFile: path.join(paths.TMP_DIR, 'browserify-cache.json'),
      transform: getTransform(opts),
      paths: [
        // Input package's NODE_MODULES
        path.join(paths.INPUT_DIR, 'node_modules'),
        // Idyll's NODE_MODULES
        path.resolve(paths.APP_PATH, 'node_modules')
      ],
      plugin: [
        (b) => {
          const aliases = {
            ast: '__IDYLL_AST__',
            components: '__IDYLL_COMPONENTS__',
            data: '__IDYLL_DATA__',
            syntaxHighlighting: '__IDYLL_SYNTAX_HIGHLIGHT__'
          };

          for (const key in output) {
            if (!aliases[key]) continue;
            b.exclude(aliases[key]);
            b.require(toStream(output[key]), {
              expose: aliases[key],
              basedir: paths.TMP_DIR
            })
          }
        }
      ]
    };

    b = browserifyInc(config);
  }

  return new Promise((resolve, reject) => {
    b.bundle((err, src) => {
      if (err) return reject(err);
      resolve(src.toString('utf8'));
    }).pipe(fs.createWriteStream(path.join(paths.TMP_DIR, 'bundle.js')));
  })
}