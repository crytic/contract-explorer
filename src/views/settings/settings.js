//#region Global Variables

// Our VSCode API instance, populated below.
vscode = null;
eventHandlersInitialized = false;

// The core state object for this webview. This is both how the underlying configuration will look
// and how state is temporarily stored/restored when the view becomes invisible/visible again.
// This actual value set represents the default configuration, with which existing configurations may be merged into.
detectors = []; // the list of detectors with check name, title, description, severity, etc.
detectorToggle = false; // the state to set all filters into next time toggle is clicked.
config = {};
workspaceFolders = [];

//#endregion

(function () {
  // Obtain the vscode api
  vscode = acquireVsCodeApi();

  //#region Command Handlers

  // Event triggered when we receive a message from the VSCode extension.
  window.addEventListener("message", (event) => {
    const data = event.data; // The json data that the extension sent
    switch (data.method) {
      case "initialize": {
        // Set the provided config and call our initialize method.
        config = data.config;
        initialize();
        break;
      }
      case "refreshDetectorTypes": {
        // Refresh our detector filter list with our provided detectors.
        detectors = data.detectors ?? [];
        detectors.sort((a, b) =>
          a.check > b.check ? 1 : b.check > a.check ? -1 : 0
        ); // sort by check
        refreshDetectorSettings();
        break;
      }
    }
  });

  //#endregion
})();

function initialize() {
  // Set our UI event handlers
  setUIEventHandlers();

  // Set our focused container to the last one when we reload this webview view.
  setFocusedContainer("detector_filter_panel");

  // We should select the appropriate compilation index on load (first or restored), and force the underlying data to load as well.
  refreshCompilationTargetDropDown(0, true);
}

function saveConfig() {
  // Post our save configuration message.
  vscode.postMessage({ method: "saveConfig", config: config });
}

function setUIEventHandlers() {
  // If we already initialized event handlers, stop
  if (eventHandlersInitialized) {
    return;
  }

  $("#navbar_item_detector_filters").on("click", (event) => {
    setFocusedContainer("detector_filter_panel");
  });
  $("#navbar_item_about").on("click", (event) => {
    setFocusedContainer("about_panel");
  });

  // Event handler for the overall detector enabled state checkbox.
  $("#chk_detectors_enabled").change(() => {
    setUnsavedDetectorsEnabled($("#chk_detectors_enabled").prop("checked"));
  });

  // Event handler for the button toggling all detector filters.
  $("#btn_toggle_all_detector_filters").on("click", (event) => {
    toggleAllDetectorFilters();
  });

  // Event handler for saving settings
  $("#btn_save_settings").on("click", (event) => {
    saveConfig();
  });

  // Set our event handlers as initialized
  eventHandlersInitialized = true;
}

//#region Menu Bar / Panel Visibility

function setFocusedContainer(containerId) {
  // Hide all child container panels.
  $("#master_container_panel").children(".container_panel").hide();

  // Set the desired container as focused.
  $("#" + containerId).show();
}

//#endregion

//#region Detector Filters

function refreshDetectorSettings() {
  // Set our enabled checkbox status
  let detectorsEnabled = getRuntimeConfigValue(["detectors", "enabled"], false);
  $("#chk_detectors_enabled").prop("checked", detectorsEnabled);

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
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.innerHTML = `<b>${detector.check}</b>: ${detector.title}`;
    label.title = detector.description;
    label.htmlFor = `detector-filter-${detector.index}`;
    const input = document.createElement("input");
    input.id = label.htmlFor;
    input.className = "detector-filter-checkbox";
    input.type = "checkbox";
    input.value = detector.check;
    input.addEventListener("change", (event) => {
      // When this is changed, set our internal state.
      setUnsavedDetectorFilterState(
        detector.check,
        event.currentTarget.checked
      );
    });

    // Determine the checked state of this detector filter
    input.checked = true;
    let hiddenDetectors = getRuntimeConfigValue(
      ["detectors", "hiddenChecks"],
      []
    );
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
  setRuntimeConfigValue(["detectors", "enabled"], enabled);
}

function setUnsavedDetectorFilterState(checkId, enabled) {
  // Obtain our hidden detector list
  let hiddenDetectors = getRuntimeConfigValue(
    ["detectors", "hiddenChecks"],
    []
  );

  // Determine if we're adding or removing in the hidden detector list.
  if (!enabled) {
    if (hiddenDetectors.indexOf(checkId) === -1) {
      hiddenDetectors.push(checkId);
    }
    hiddenDetectors.sort();
  } else {
    // Remove the checkId from our hidden detector list.
    hiddenDetectors = hiddenDetectors.filter((v) => v !== checkId);
  }

  // Set our new hidden detector list
  setRuntimeConfigValue(["detectors", "hiddenChecks"], hiddenDetectors);
}

function toggleAllDetectorFilters() {
  // Obtain all detector filter checkboxes by class.
  let detectorFilterCheckboxes = document.getElementsByClassName(
    "detector-filter-checkbox"
  );

  // Set the checked state for all checkboxes, triggering the 'change' event, as it isn't triggered
  // when checks are changed programmatically.
  for (let detectorFilterCheckbox of detectorFilterCheckboxes) {
    detectorFilterCheckbox.checked = detectorToggle;
    detectorFilterCheckbox.dispatchEvent(new Event("change"));
  }

  // Toggle the toggle variable
  detectorToggle = !detectorToggle;
}

//#endregion

//#region Utilities

function getRuntimeConfigValue(keyPath, defaultValue = undefined) {
  // Loop through all keys in our path and iterate until the end.
  currentPosition = config;
  for (let key of keyPath) {
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
        currentPosition[key] = {};
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
