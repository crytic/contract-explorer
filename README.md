# VScode Slither Extension

Vscode extension for Slither smart contract audit tool

## Features
* Enables you to configure the list of detectors to run against your project


## Requirements
* Slither ( > 0.4.0 ) 
You can install slither via `pip install slither-analyzer`
or install from source using the respository https://github.com/trailofbits/slither

## Configure Extension
You can configure the list of detectors to run against your project by providing the list
of detectors in your `.vscode/settings.json` as specified below

```js
{
    "slither.exclude": ["unused-state"],
    "slither.include": ["external-function"]
}
```

An example configuration can be found in `example/settings.json`

### Run Extension
Run the extension from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) 
and typing `Run Slither`.


### License
MIT