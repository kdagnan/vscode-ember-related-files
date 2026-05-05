'use strict'

const { window, workspace, commands, Uri } = require('vscode')
const fs = require('fs')
const path = require('path')
const { join, sep: fileSeparator } = require('path')
const findRelated = require('./find-related-files')

const findRelatedFiles = findRelated.findRelatedFiles

class TypeItem {
  constructor(item, rootPath) {
    this.label = item.label
    this.description = item.path
    this.rootPath = rootPath
  }

  path() {
    return join(this.rootPath, this.description)
  }

  uri() {
    return Uri.file(this.path())
  }
}

function open(item) {
  workspace.openTextDocument(item.uri()).then((doc) =>
    window.showTextDocument(doc.uri, { preview: config('enablePreview') })
  )
}

function config(key) {
  return workspace.getConfiguration('emberRelatedFiles').get(key)
}

function isEmberProject(dirPath) {
  return isDir(dirPath) && isFile(dirPath, 'ember-cli-build.js')
}

function isFile(...pathParts) {
  try {
    return fs.lstatSync(path.join(...pathParts)).isFile()
  } catch (error) {}
  return false
}

function isDir(...pathParts) {
  try {
    return fs.lstatSync(path.join(...pathParts)).isDirectory()
  } catch (error) {}
  return false
}

function findEmberFilePath(rootPath, filePath) {
  const filePathParts = filePath.split(fileSeparator)

  while (!isEmberProject(rootPath) && filePathParts.length) {
    rootPath = path.join(rootPath, filePathParts.splice(0, 1).pop())
    filePath = path.join(...filePathParts)
  }

  if (!filePathParts.length) {
    return { exists: false }
  }

  return { exists: true, rootPath, filePath }
}

function activate(context) {
  const disposable = commands.registerCommand('relatedFiles.relatedFiles', () => {
    if (!window.activeTextEditor) {
      return
    }

    const relativePath = workspace.asRelativePath(window.activeTextEditor.document.fileName, false)
    const { uri: { fsPath: workspaceFolder } } = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri)
    const { exists, rootPath, filePath } = findEmberFilePath(workspaceFolder, relativePath)

    if (!exists) {
      return
    }

    let normalizedFilePath = filePath
    let normalizedRootPath = rootPath

    if (fileSeparator === '\\') {
      normalizedFilePath = filePath.replace(/\\/g, '/')
      normalizedRootPath = rootPath.replace(/\\/g, '/')
    }

    const items = findRelatedFiles(normalizedRootPath, normalizedFilePath)
      .map((item) => new TypeItem(item, normalizedRootPath))

    if (items.length === 0) {
      return
    }

    if (items.length === 1 && !config('showQuickPickForSingleOption')) {
      return open(items.pop())
    }

    window.showQuickPick(items, { placeHolder: 'Select File', matchOnDescription: true }).then((item) => {
      if (item) {
        open(item)
      }
    })
  })

  context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
