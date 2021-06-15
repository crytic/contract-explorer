detectors = []; // the list of detectors with check name, title, description, severity, etc.
detectorToggle = false; // the state to set all filters into next time toggle is clicked.

// The core state object for this webview. This is both how the underlying configuration will look
// and how state is temporarily stored/restored when the view becomes invisible/visible again.
state = {
    runtime: {
        focusedContainerId: 'compilation_panel',
        detectors: [],  // the list of detectors with check name, title, description, severity, etc.
        detectorToggle: false, // the state to set all filters into next time toggle is clicked.
    },
    config: {
        detectorFilters: {
            // We define a global detector filter object for now, leaving room for compilation-specific filters.
            global: {
                // detector.check (string): enabled(boolean, default=true)
            }
        }
    }
};

(function() {
    // Obtain the vscode api
    const vscode = acquireVsCodeApi();
    // Restore some potential previous state.
    state = Object.assign({}, state, vscode.getState());

    // Store a copy of our state periodically.
    setInterval(
        () => {
            vscode.setState(state);
        }, 100
    );


    window.onload = () => {
        setFocusedContainer(state.runtime.focusedContainerId);
    };

    //#region Command Handlers
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.method) {
            case 'refreshDetectors':
                {
                    // Refresh our detector filter list with our provided detectors.
                    state.runtime.detectors = message.detectors ?? [];
                    state.runtime.detectors.sort((a,b) => (a.check > b.check) ? 1 : ((b.check > a.check) ? -1 : 0)); // sort by check
                    setRuntimeConfigValue(['runtime', 'detectors'], state.runtime.detectors);
                    refreshDetectorFilterList();
                    break;
                }
        }
    });
    //#endregion
}());

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
    $('#compilation_panel_basic').toggle(!useCustomView);
    $('#compilation_panel_custom').toggle(useCustomView);
}

function addCompilationGroup() {

}

function removeCompilationGroup() {

}

function selectCompilationGroup() {
    
}
//#endregion

//#region Utilities
function getRuntimeConfigValue(keyPath) {
    // Loop through all keys in our path and iterate until the end.
    currentPosition = state.config;
    for(let key of keyPath) {
        // If the next key doesn't exist in our position, return undefined.
        if (!(key in currentPosition)) {
            return undefined;
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
            setRuntimeDetectorFilterState(detector.check, event.currentTarget.checked);
        });

        // Determine the checked state of this detector filter
        input.checked = true;
        let detectorFilterState = getRuntimeConfigValue(['detectorFilters', 'global', input.value]);
        if (detectorFilterState === false) {
            input.checked = false;
        }

        // Add the items to eachother accordingly.
        li.append(input);
        li.appendChild(label);
        ul.appendChild(li);
    }
}

function setRuntimeDetectorFilterState(checkId, enabled) {
    // Set our detector filtered state.
    setRuntimeConfigValue(['detectorFilters', 'global', checkId], enabled);
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