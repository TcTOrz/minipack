const fs = require('fs')
const path = require('path')

const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

let ID = 0

function createAsset(filename) {
  const constant = fs.readFileSync(filename, 'utf-8')

  const ast = parser.parse(constant, {
    sourceType: 'module',
  })

  const dependencies = []
  traverse(ast, {
    enter(path) {
      if (path.node.type === 'ImportDeclaration') {
        dependencies.push(path.node.source.value)
      }
    },
  })

  const id = ID++

  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env'],
  })

  return {
    id,
    filename,
    dependencies,
    code,
  }
}

function createGraph(entry) {
  const entryAsset = createAsset(entry)

  const quene = [entryAsset]
  for (const asset of quene) {
    const dirname = path.dirname(asset.filename)

    asset.mapping = {}
    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath)
      const childAsset = createAsset(absolutePath)
      asset.mapping[relativePath] = childAsset.id
      quene.push(childAsset)
    })
  }
  return quene
}

function createBundle(graph) {
  let modules = ''
  graph.forEach((mod) => {
    modules += `${mod.id}: [
      function(require, module, exports) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)}
    ],`
  })
  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id]
        function localRequire(relativePath) {
          return require(mapping[relativePath])
        }
        const module = { exports: {} }
        fn(localRequire, module, module.exports)
        return module.exports
      }
      require(0)
    })({${modules}})
  `
  return result
}

// const assets = createAsset('./example/entry.js')
const graph = createGraph('./example/entry.js')
const result = createBundle(graph)
// console.log(result)
