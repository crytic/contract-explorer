# Setting up a development environment

## Preprequisites

- NodeJS & npm
- VSCode
- (optional) A clean Python venv

## Building slither-lsp

After cloning slither-lsp in a convenient location, run the following command to install it and its dependencies to your Python environment:

    pip install .

You may then want to actually _uninstall_ it afterwards, so that any change made to the source code is directly picked up the next time you execute the module without having to reinstall it.

    pip uninstall slither-lsp

## Starting slither-lsp in TCP mode

In order to make it easier (or even possible) to attach a debugger to the Python process that runs slither-lsp, it's possible to start it in TCP mode:

    python -m slither_lsp tcp --port 12345

## Building slither-vscode

After cloning slither-vscode in a convenient location, run the following commands from the source directory:

    npm install
    npm install -g vsce
    npm run compile

## Running a VSCode instance with slither-vscode loaded

    env EXISTING_LANGUAGE_SERVER_PORT=12345 code --extensionDevelopmentPath=/path/to/slither-vscode

## Debugging slither-lsp and slither-vscode at the same time from the same VSCode instance

This is the `launch.json` file I personally use, you will need to adjust paths accordingly:

    {
        "version": "0.2.0",
        "configurations": [
            {
                // This configuration launches slither-lsp as a subprocess and needs it to be installed
                "name": "Extension",
                "type": "extensionHost",
                "request": "launch",
                "runtimeExecutable": "${execPath}",
                "args": [
                    "--extensionDevelopmentPath=${workspaceFolder}/slither-vscode"
                ],
                "outFiles": [
                    "${workspaceFolder}/slither-vscode/out/**/*.js"
                ],
                "skipFiles": [
                    "**/app/out/vs/**.js"
                ],
                "env": {
                    "PATH": "${env:PATH}:${workspaceFolder}/slither-venv/bin"
                }
            },
            {
                "name": "Extension (attach to existing over network)",
                "type": "extensionHost",
                "request": "launch",
                "runtimeExecutable": "${execPath}",
                "args": [
                    "--extensionDevelopmentPath=${workspaceFolder}/slither-vscode"
                ],
                "outFiles": [
                    "${workspaceFolder}/slither-vscode/out/**/*.js"
                ],
                "skipFiles": [
                    "**/app/out/vs/**.js"
                ],
                "env": {
                    "EXISTING_LANGUAGE_SERVER_PORT": "12345"
                }
            },
            {
                "name": "LSP Server",
                "type": "debugpy",
                "request": "launch",
                "module": "slither_lsp",
                "cwd": "${workspaceFolder}/slither-lsp",
                "python": "${workspaceFolder}/slither-venv/bin/python3",
                "args": [
                    "--loglevel=INFO",
                    "tcp",
                    "--port=12345"
                ]
            }
        ]
    }