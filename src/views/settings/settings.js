//#region Global Variables

// Our VSCode API instance, populated below.
vscode = null;
eventHandlersInitialized = false;

// The core state object for this webview. This is both how the underlying configuration will look
// and how state is temporarily stored/restored when the view becomes invisible/visible again.
// This actual value set represents the default configuration, with which existing configurations may be merged into.
detectors = [];  // the list of detectors with check name, title, description, severity, etc.
detectorToggle = false; // the state to set all filters into next time toggle is clicked.
config = {};
workspaceFolders = [];

//#endregion

(function() {
    // Obtain the vscode api
    vscode = acquireVsCodeApi();

    //#region Command Handlers

    // Event triggered when we receive a message from the VSCode extension.
    window.addEventListener('message', event => {
        const data = event.data; // The json data that the extension sent
        switch (data.method) {
            case 'initialize': {
                // Set the provided config and call our initialize method.
                config = data.config;
                initialize();
                break;
            }
            case 'refreshDetectorTypes': {
                // Refresh our detector filter list with our provided detectors.
                detectors = data.detectors ?? [];
                detectors.sort((a,b) => (a.check > b.check) ? 1 : ((b.check > a.check) ? -1 : 0)); // sort by check
                refreshDetectorSettings();
                break;
            }
            case 'refreshWorkspaceFolders': {
                // Refresh our detector filter list with our provided detectors.
                workspaceFolders = data.folders ?? [];
                refreshWorkspaceFoldersList();
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
    setFocusedContainer('compilation_panel');

    // We should select the appropriate compilation index on load (first or restored), and force the underlying data to load as well.
    refreshCompilationTargetDropDown(0, true);
}

function saveConfig() {
    // Post our save configuration message.
    vscode.postMessage({method: 'saveConfig', config: config});
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
        refreshCompilationTargetData();
    });
    $('#btn_add_compilation_group').on('click', (event) => {
        addCompilationTarget();
    });
    $('#btn_remove_compilation_group').on('click', (event) => {
        removeCompilationTarget();
    });

    // Event handler for selecting a different workspace name
    $('#dropdown_workspace_name').on('change', (event) => {
        setUnsavedCompilationWorkspaceName();
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

    // Event handler for the overall detector enabled state checkbox.
    $('#chk_detectors_enabled').change(() => {
        setUnsavedDetectorsEnabled($('#chk_detectors_enabled').prop('checked'));
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
}

//#endregion

//#region Compilation Units

function setCompilationTypeView(useCustomView) {
    // Cache relevant components.
    let $basic = $('#compilation_panel_basic');
    let $solc_standard_json = $('#compilation_panel_custom');

    // Toggle our checked status.
    $basic.toggle(!useCustomView);
    $solc_standard_json.toggle(useCustomView);

    // Obtain the selected index.
    let selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);

    // If we have a compilation selected, we want to set its type
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        // Get all view radio buttons
        let compilationTypeRadios = document.getElementsByName('compilation_type');

        // Find the radio button which is checked/selected and use its value as the compilation type.
        for (let compilationTypeRadio of compilationTypeRadios) {
            if (compilationTypeRadio.checked) {
                compilations[selectedIndex].targetType = compilationTypeRadio.value;
            }
        }
    }
}


function addCompilationTarget() {
    // Create data for a new compilation
    let newCompilationData = {
        targetType: "basic",
        targetBasic: {
            target: "."
        },
        targetStandardJson: {},
        cwdWorkspace: undefined,
    }

    // Obtain our compilation array, add our new compilation, and set it.
    let compilations = getRuntimeConfigValue(['compilations'], []);
    compilations.push(newCompilationData);
    setRuntimeConfigValue(['compilations'], compilations);

    // Refresh our compilation to the added compilation.
    refreshCompilationTargetDropDown(compilations.length - 1, true);
}

function removeCompilationTarget() {
    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);

    // Obtain the selected index.
    let selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // If we have a valid index, remove the item from our compilation array, and select the previous item.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        compilations.splice(selectedIndex, 1);
        refreshCompilationTargetDropDown(Math.max(0, selectedIndex - 1), true);
    }
}

function refreshCompilationTargetDropDown(selectedIndex=null, forceCompilationDataReload=false) {
        // Cache our controls.
        let $dropdown = $('#dropdown_compilation_group');

        // Obtain our index to select. If the index provided is null, we refresh on the current index.
        let previousSelectedIndex = $dropdown.prop('selectedIndex');
        selectedIndex = selectedIndex ?? previousSelectedIndex;

        // Obtain our compilation array.
        let compilations = getRuntimeConfigValue(['compilations'], []);
    
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

function refreshCompilationTargetData() {
    // Cache our controls.
    let $compilation_target = $('#compilation_target');
    let $compilation_targets = $('#compilation_targets');

    // Get the selected index.
    let selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);

    // Reset state first.
    $compilation_target.val("");
    $compilation_targets.empty();

    // If we have a valid index, load actual compilation data now.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        // We have a valid index, fetch our compilation
        let compilation = compilations[selectedIndex];

        // Select the compilation type
        if(typeof compilation.targetType === 'string') {
            switch (compilation.targetType) {
                case 'basic': {
                    $('#radio_compilation_type_basic').prop('checked', true).trigger('change');
                    break;
                }
                case 'standard_json': {
                    $('#radio_compilation_type_solc_standard_json').prop('checked', true).trigger('change');
                    break;
                }
            }
        }

        // Set the compilation target if we have one
        if(typeof compilation.targetBasic?.target === 'string') {
            $compilation_target.val(compilation.targetBasic.target);
        }

        // Set the workspace name if we have one
        refreshWorkspaceFoldersList();
    }
}

function setUnsavedBasicCompilationTarget() {
    // Get the selected compilation index.
    let selectedIndex = $('#dropdown_compilation_group').prop('selectedIndex');

    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);

    // Set the runtime compilation state target if we have a valid index.
    if (selectedIndex < compilations.length && selectedIndex >= 0) {
        compilations[selectedIndex].targetBasic.target = $('#compilation_target').val();
    }
}


function refreshWorkspaceFoldersList() {
    // Cache our controls.
    let $dropdown_workspace_name = $('#dropdown_workspace_name');

    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);
    let targetWorkspaceName = null;

    // If we have a valid selected compilation index, obtain actual compilation data now.
    let selectedCompilationIndex = $('#dropdown_compilation_group').prop('selectedIndex');
    if (selectedCompilationIndex < compilations.length && selectedCompilationIndex >= 0) {
        // We have a valid index, fetch our cwd workspace name for this compilation.
        targetWorkspaceName = compilations[selectedCompilationIndex].cwdWorkspace;
    }
    

    // Reset our drop down.
    $dropdown_workspace_name.empty();

    // Populate the compilations
    //$('#dropdown_compilation_group').append('<option disabled selected value> -- select a compilation group -- </option>')
    for(let i = 0; i < workspaceFolders.length; i++) {
        // Create a select option for this workspace folder name.
        let opt = document.createElement('option');
        opt.value = workspaceFolders[i].name;
        opt.innerHTML = workspaceFolders[i].name;
        $dropdown_workspace_name.append(opt);

        // If our cwd workspace name is this one, select this item.
        if (targetWorkspaceName === opt.value) {
            $dropdown_workspace_name.prop('selectedIndex', i);
        }
    }

    // If we had no target workspace name, select the first option and set it.
    if (typeof targetWorkspaceName !== 'string') {
        $dropdown_workspace_name.prop('selectedIndex', workspaceFolders.length > 0 ? 0 : -1);
        setUnsavedCompilationWorkspaceName();
    }
}

function setUnsavedCompilationWorkspaceName() {
    // Cache our controls.
    let $dropdown_workspace_name = $('#dropdown_workspace_name');
    let selectedWorkspaceFolderName = $dropdown_workspace_name.val();

    // Obtain our compilation array.
    let compilations = getRuntimeConfigValue(['compilations'], []);

    // If we have a valid selected compilation index, obtain actual compilation data now.
    let selectedCompilationIndex = $('#dropdown_compilation_group').prop('selectedIndex');
    if (selectedCompilationIndex < compilations.length && selectedCompilationIndex >= 0) {
        // We have a valid index, fetch our cwd workspace name for this compilation.
        compilations[selectedCompilationIndex].cwdWorkspace = selectedWorkspaceFolderName;
    }
}

//#endregion

//#region Detector Filters

function refreshDetectorSettings() {
    // Set our enabled checkbox status
    let detectorsEnabled = getRuntimeConfigValue(['detectors', 'enabled'], false);
    $('#chk_detectors_enabled').prop('checked', detectorsEnabled);

    // Clear our list of detectors.
    var ul = document.getElementById("detector_filter_list");
    ul.innerHTML = "";

    // If the detectors list is null, exit
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
        let hiddenDetectors = getRuntimeConfigValue(['detectors', 'hiddenChecks'], []);
        if (hiddenDetectors.includes(detector.check)) {
            input.checked = false;
        }

        // Add the items to eachother accordingly.
        li.append(input);
        li.appendChild(label);
        ul.appendChild(li);
    }
}

function setUnsavedDetectorsEnabled(enabled) {
    // Save our enabled status.
    setRuntimeConfigValue(['detectors', 'enabled'], enabled);
}

function setUnsavedDetectorFilterState(checkId, enabled) {
    // Obtain our hidden detector list
    let hiddenDetectors = getRuntimeConfigValue(['detectors', 'hiddenChecks'], []);

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
    setRuntimeConfigValue(['detectors', 'hiddenChecks'], hiddenDetectors);
}

function toggleAllDetectorFilters() {
    // Obtain all detector filter checkboxes by class.
    let detectorFilterCheckboxes = document.getElementsByClassName("detector-filter-checkbox");

    // Set the checked state for all checkboxes, triggering the 'change' event, as it isn't triggered
    // when checks are changed programmatically.
    for(let detectorFilterCheckbox of detectorFilterCheckboxes) {
        detectorFilterCheckbox.checked = detectorToggle;
        detectorFilterCheckbox.dispatchEvent(new Event('change'));
    }

    // Toggle the toggle variable
    detectorToggle = !detectorToggle;
}

//#endregion

//#region Utilities

function getRuntimeConfigValue(keyPath, defaultValue=undefined) {
    // Loop through all keys in our path and iterate until the end.
    currentPosition = config;
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
    currentPosition = config;
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
    currentPosition = config;
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
