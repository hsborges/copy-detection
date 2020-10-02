#!/usr/bin/env node
const path = require('path')
const glob = require('glob')
const open = require('open')
const consola = require('consola')
const unrar = require('node-unrar-js')
const copy = require('recursive-copy')
const decompress = require('decompress')

const { reduce } = require('lodash')
const { program } = require('commander')
const { exec } = require('child_process')
const { withDir, dirSync } = require('tmp-promise')

program
  .arguments('<directory>')
  .requiredOption('-s, --suffixes <suffixes...>', 'List of all filename suffixes')
  .option('-l, --language <language>', 'JPlag supported language', 'text')
  .option('-o, --output-dir <directory>', 'Output directory')
  .action(directory =>
    withDir(
      meta =>
        copy(path.resolve(process.cwd(), directory), meta.path).then(
          () =>
            new Promise((resolve, reject) =>
              glob(
                '**/*.+(zip|bz|bz2|bzip2|tar|gz|rar)',
                { cwd: meta.path, nosort: true },
                async (err, results) => {
                  if (err) return reject(err)

                  consola.info(`Extracting (${results.length}) compressed files ...`)

                  for (const file of results) {
                    const input = path.resolve(meta.path, file)
                    const dest = path.dirname(input)

                    try {
                      if (file.toLowerCase().endsWith('.rar')) {
                        unrar.createExtractorFromFile(input, dest).extractAll()
                      } else {
                        await decompress(input, dest)
                      }
                    } catch (error) {
                      consola.error(error)
                    }
                  }

                  consola.info('Running jplag tool ...')
                  const outputDir = program.outputDir || dirSync().name
                  const jplagFile = path.resolve(__dirname, 'lib', 'jplag.jar')
                  const jplagOptions = reduce(
                    {
                      p: program.suffixes.join(','),
                      l: program.language,
                      r: outputDir
                    },
                    (r, v, k) => `-${k} ${v} ${r}`,
                    ''
                  )

                  exec(`java -jar ${jplagFile} -s ${jplagOptions} ${meta.path}`, async err => {
                    if (err) {
                      reject(err)
                    } else {
                      consola.info('Openning analysis result ')
                      const file = path.resolve(outputDir, 'index.html')
                      await open(file, { wait: true }).catch(reject)
                      resolve()
                    }
                  })
                }
              )
            )
        ),
      { unsafeCleanup: true }
    ).catch(consola.error)
  )

program.parse(process.argv)
