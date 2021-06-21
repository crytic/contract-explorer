//#region Global Variables

// Our VSCode API instance, populated below.
vscode = null;
eventHandlersInitialized = false

// The core state object for this webview. This is both how the underlying configuration will look
// and how state is temporarily stored/restored when the view becomes invisible/visible again.
// This actual value set represents the default configuration, with which existing configurations may be merged into.
state = {
    runtime: {
        focusedContainerId: 'compilation_panel',
        focusedCompilationIndex: 0,
        detectors: [],  // the list of detectors with check name, title, description, severity, etc.
        detectorToggle: false, // the state to set all filters into next time toggle is clicked.
    },
    config: {
        detectors: {
            // We define a global detector filter object for now, leaving room for compilation-specific filters.
            hidden: [] // detector.check (string)
        },
        compilations: [
            /*
            {
                type: basic | solc_standard_json,
                basic: {
                    target: "."
                },
                solc_standard_json: {
                    targets: [
                        file1.sol,
                        file2.sol,
                        ...
                    ]
                }
                shared: {
                    remappings: [
                        {
                            src: "",
                            dst: ""
                        }
                    ]
                }
            }
            */
        ]
    }
};

//#endregion

(function() {
    // Obtain the vscode api
    vscode = acquireVsCodeApi();
    // Restore some potential previous state and merge it with our default.
    //state = Object.assign({}, state, vscode.getState());

    // Store a copy of our state periodically.
    setInterval(
        () => {
            // Save state to the VsCodeApi
            vscode.setState(state);
            // Save runtime state to our extension
            vscode.postMessage({method: 'storeUnsavedState', state: state});
        }, 100
    );

    //#region Command Handlers

    // Event triggered when we receive a message from the VSCode extension.
    window.addEventListener('message', event => {
        const data = event.data; // The json data that the extension sent
        switch (data.method) {
            case 'initialize': {
                // Merge the provided configuration with the default in case it is a previous version configuration
                // which was saved prior to the introduction of newly expected keys.
                if (data.config) {
                    state.config = Object.assign({}, state.config, data.config);
                }
                initialize();
                break;
            }
            case 'restoreUnsavedState': {
                // Restore our provided state and re-initialize.
                state = data.state;
                initialize();
                break;
            }
            case 'refreshDetectors': {
                // Refresh our detector filter list with our provided detectors.
                state.runtime.detectors = data.detectors ?? [];
                state.runtime.detectors.sort((a,b) => (a.check > b.check) ? 1 : ((b.check > a.check) ? -1 : 0)); // sort by check
                refreshDetectorFilterList();
                break;
            }
        }
    });

    //#endregion
    
}());

function initialize() {
    // Set our UI event handlers
    setUIEventHandlers();

    // Set our focused container to the last one when we reload this webview view.
    setFocusedContainer(state.runtime.focusedContainerId);

    // We should select the appropriate compilation index on load (first or restored), and force the underlying data to load as well.
    refreshCompilationGroupDropDown(state.runtime.focusedCompilationIndex, true);
}

function saveConfig() {
    // Post our save configuration message.
    vscode.postMessage({method: 'saveConfig', config: state.config});
}

function setUIEventHandlers() {
    // If we already initialized event handlers, stop
    if(eventHandlersInitialized) {
        return;
    }

    // Event handlers for navigation menu bar
    $('#navbar_item_compilations').on('click', (event) => {
        setFocusedContainer('compilation_panel');
    });
    $('#navbar_item_detector_filters').on('click', (event) => {
        setFocusedContainer('detector_filter_panel');
    });
    $('#navbar_item_about').on('click', (event) => {
        setFocusedContainer('about_panel');
    });
    
    // Event handler for selecting/adding/removing a compilation group
    $('#dropdown_compilation_group').on('change', (event) => {
        refreshCompilationGroupData();
    });
    $('#btn_add_compilation_group').on('click', (event) => {
        addCompilationGroup();
    });
    $('#btn_remove_compilation_group').on('click', (event) => {
        removeCompilationGroup();
    });

    // Event handlers for compilation group types
    $('#radio_compilation_type_basic').on('change', (event) => {
        setCompilationTypeView(false);
    });
    $('#radio_compilation_type_solc_standard_json').on('change', (event) => {
        setCompilationTypeView(true);
    });

    // Event handlers for compilation group fields.
    $('#compilation_target').on('change', (event) => {
        setUnsavedBasicCompilationTarget();
    });

    // Event handler for the button toggling all detector filters.
    $('#btn_toggle_all_detector_filters').on('click', (event) => {
        toggleAllDetectorFilters();
    });

    // Event handler for saving settings
    $('#btn_save_settings').on('click', (event) => {
        saveConfig();
    });

    // Set our event handlers as initialized
    eventHandlersInitialized = true;
}

//#region Menu Bar / Panel Visibility

function setFocusedContainer(containerId) {
    // Hide all child container panels.
    $('#master_container_panel').children('.container_panel').hide();

    // Set the desired container as focused.
    $('#' + containerId).show();

    // Set our runtime state for the current view (so it can be restored if this panel is unloaded)
    state.runtime.focusedContainerId = containerId;
}

//#endregion

//#region Compilation Units

function setCompilationTypeView(useCustomView) {
    // Cache relevant components.
    $basic = $('#compilation_panel_basic');
    $solc_standard_json = $('#compilation_panel_custom');

    // Toggle our checked status.
    $basic.toggle(!useCustomView);
    $solc_standard_json.toggle(useCustomView);

    // Obtain the selected index.
    selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // Obtain our compilation array.
    compilations = getRuntimeConfigValue(['compilations'], []);

    // If we have a compilation selected, we want to set its type
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        // Get all view radio buttons
        let compilationTypeRadios = document.getElementsByName('compilation_type');

        // Find the radio button which is checked/selected and use its value as the compilation type.
        for (let compilationTypeRadio of compilationTypeRadios) {
            if (compilationTypeRadio.checked) {
                compilations[selectedIndex].type = compilationTypeRadio.value;
            }
        }
    }
}



function addCompilationGroup() {
    // Create data for a new compilation
    let newCompilationData = {
        type: "basic",
        basic: {
            target: "."
        },
        solc_standard_json: {
            targets: []
        },
        shared: {
            remappings: []
        }
    }

    // Obtain our compilation array, add our new compilation, and set it.
    compilations = getRuntimeConfigValue(['compilations'], []);
    compilations.push(newCompilationData);
    setRuntimeConfigValue(['compilations'], compilations);

    // Refresh our compilation to the added compilation.
    refreshCompilationGroupDropDown(compilations.length - 1);
}

function removeCompilationGroup() {
    // Obtain our compilation array.
    compilations = getRuntimeConfigValue(['compilations'], []);

    // Obtain the selected index.
    selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // If we have a valid index, remove the item from our compilation array, and select the previous item.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        compilations.splice(selectedIndex, 1);
        refreshCompilationGroupDropDown(Math.max(0, selectedIndex - 1));
    }
}

function refreshCompilationGroupDropDown(selectedIndex=null, forceCompilationDataReload=false) {
        // Cache our controls.
        $dropdown = $('#dropdown_compilation_group');

        // Obtain our index to select. If the index provided is null, we refresh on the current index.
        let previousSelectedIndex = $dropdown.prop('selectedIndex');
        selectedIndex = selectedIndex ?? previousSelectedIndex;

        // Obtain our compilation array.
        compilations = getRuntimeConfigValue(['compilations'], []);
    
        // Reset our drop down.
        $dropdown.empty();

        // Populate the compilations
        //$('#dropdown_compilation_group').append('<option disabled selected value> -- select a compilation group -- </option>')
        for(let i = 0; i < compilations.length; i++) {
            $dropdown.append(`<option>${i + 1}</option>`);
        }
        // Set our selected index for the UI.
        $dropdown.prop('selectedIndex', selectedIndex);

        // If we changed the index or want to force a compilation data reload, trigger our change event.
        if (previousSelectedIndex != selectedIndex || forceCompilationDataReload) {
            $dropdown.trigger('change');
        }
}

function refreshCompilationGroupData() {
    // Cache our controls.
    $dropdown = $('#dropdown_compilation_group');
    $compilation_target = $('#compilation_target');
    $compilation_targets = $('#compilation_targets');

    // Get the selected index.
    let selectedIndex = $dropdown.prop('selectedIndex');

    // Obtain our compilation array.
    compilations = getRuntimeConfigValue(['compilations'], []);

    // Reset state first.
    $compilation_target.val("");
    $compilation_targets.empty();

    // If we have a valid index, load actual compilation data now.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        // We have a valid index, fetch our compilation
        let compilation = compilations[selectedIndex];

        // Select the compilation type
        if(typeof compilation.type === 'string') {
            switch (compilation.type) {
                case 'basic': {
                    $('#radio_compilation_type_basic').prop('checked', true).trigger('change');
                    break;
                }
                case 'solc_standard_json': {
                    $('#radio_compilation_type_solc_standard_json').prop('checked', true).trigger('change');
                    break;
                }
            }
        }

        // Set the compilation target if we have one
        if(typeof compilation.basic?.target === 'string') {
            $compilation_target.val(compilation.basic.target);
        }

        // Set the compilation targets for solc standard JSON.
        if(Array.isArray(compilation.solc_standard_json?.targets)) {
            // TODO: Populate solc standard JSON compilation.
        }
    }

    
    // Backup our current selected index.
    state.runtime.focusedCompilationIndex = selectedIndex;
}

function setUnsavedBasicCompilationTarget() {
    // Get the selected compilation index.
    let selectedIndex = $dropdown.prop('selectedIndex');

    // Obtain our compilation array.
    compilations = getRuntimeConfigValue(['compilations'], []);

    // Set the runtime compilation state target if we have a valid index.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        compilations[selectedIndex].basic.target = $('#compilation_target').val();
    }
}

//#endregion

//#region Detector Filters

function refreshDetectorFilterList() {
    // Clear our list of detectors.
    var ul = document.getElementById("detector_filter_list");
    ul.innerHTML = "";

    // If the detectors list is null, exit
    let detectors = state.runtime.detectors;
    if (detectors == null) {
        return;
    }

    // Populate the list of detectors
    for (let detector of detectors) {
        // Create components for a checked list box row.
        const li = document.createElement('li');
        const label = document.createElement('label');
        label.innerHTML = `<b>${detector.check}</b>: ${detector.title}`;
        label.title = detector.description;
        label.htmlFor = `detector-filter-${detector.index}`;
        const input = document.createElement('input');
        input.id = label.htmlFor;
        input.className = 'detector-filter-checkbox';
        input.type = 'checkbox';
        input.value = detector.check;
        input.addEventListener('change', (event) => {
            // When this is changed, set our internal state.
            setUnsavedDetectorFilterState(detector.check, event.currentTarget.checked);
        });

        // Determine the checked state of this detector filter
        input.checked = true;
        let hiddenDetectors = getRuntimeConfigValue(['detectors', 'hidden'], []);
        if (hiddenDetectors.includes(detector.check)) {
            input.checked = false;
        }

        // Add the items to eachother accordingly.
        li.append(input);
        li.appendChild(label);
        ul.appendChild(li);
    }
}

function setUnsavedDetectorFilterState(checkId, enabled) {
    // Obtain our hidden detector list
    let hiddenDetectors = getRuntimeConfigValue(['detectors', 'hidden'], []);

    // Determine if we're adding or removing in the hidden detector list.
    if (!enabled) {
        if (hiddenDetectors.indexOf(checkId) === -1) {
            hiddenDetectors.push(checkId);
        }
        hiddenDetectors.sort();
    } else {
        // Remove the checkId from our hidden detector list.
        hiddenDetectors = hiddenDetectors.filter(v => v !== checkId);
    }

    // Set our new hidden detector list
    setRuntimeConfigValue(['detectors', 'hidden'], hiddenDetectors);
}

function toggleAllDetectorFilters() {
    // Obtain all detector filter checkboxes by class.
    let detectorFilterCheckboxes = document.getElementsByClassName("detector-filter-checkbox");

    // Set the checked state for all checkboxes, triggering the 'change' event, as it isn't triggered
    // when checks are changed programmatically.
    for(let detectorFilterCheckbox of detectorFilterCheckboxes) {
        detectorFilterCheckbox.checked = state.runtime.detectorToggle;
        detectorFilterCheckbox.dispatchEvent(new Event('change'));
    }

    // Toggle the toggle variable
    state.runtime.detectorToggle = !state.runtime.detectorToggle;
}

//#endregion

//#region Utilities

function getRuntimeConfigValue(keyPath, defaultValue=undefined) {
    // Loop through all keys in our path and iterate until the end.
    currentPosition = state.config;
    for(let key of keyPath) {
        // If the next key doesn't exist in our position, return undefined.
        if (!(key in currentPosition)) {
            return defaultValue;
        }

        // Otherwise iterate by updating the current position.
        currentPosition = currentPosition[key];
    }

    // If we made it to the end, the current position is our return value.
    return currentPosition;
}

function setRuntimeConfigValue(keyPath, val) {
    // Loop through all keys in our path, creating new objects if needed, until the end.
    currentPosition = state.config;
    for (let i = 0; i < keyPath.length; i++) {
        // If this isn't the last key
        let key = keyPath[i];
        if (i < keyPath.length - 1) {
            // If the next key doesn't exist at this position, create a new mapping.
            if (!(key in currentPosition)) {
                currentPosition[key] = {}
            }
            currentPosition = currentPosition[key];
        } else {
            // This is the last key, so we set the value.
            currentPosition[key] = val;
        }
    }
}

function deleteRuntimeConfigValue(keyPath) {
    // Traverse through all keys in our path until we get to the last one, which we remove.
    currentPosition = state.config;
    for (let i = 0; i < keyPath.length; i++) {
        // If this isn't the last key
        let key = keyPath[i];
        if (i < keyPath.length - 1) {
            // If the next key doesn't exist at this position, stop, our target key cannot exist.
            if (!(key in currentPosition)) {
                return;
            }
            currentPosition = currentPosition[key];
        } else {
            // This is the last key, so we delete it.
            currentPosition.delete(key);
        }
    }
}
//#endregion
