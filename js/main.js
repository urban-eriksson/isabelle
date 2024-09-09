import {fetchAllData, transformItem, getAllLocations} from './query.js'

document.addEventListener('DOMContentLoaded', function() {

    // Add event listener to the settings icon
    document.getElementById('settings-icon').addEventListener('click', function() {
        window.location.href = 'settings.html'; // Redirects to the settings page
    });

    // Array of button ids
    const buttonIds = ['button1', 'button2', 'button3','button4', 'button5', 'button6','button7', 'button8', 'button9'];

    // Initialize or load button states
    buttonIds.forEach(id => {
        const storedState = localStorage.getItem(id);
        const button = document.getElementById(id);
        if (storedState === 'on') {
            button.classList.add('button-on');
        } else {
            button.classList.add('button-off');
        }

        // Adding click event listener to toggle state
        button.addEventListener('click', () =>  {
            toggleButton(id);
            refreshTable(); // Refresh the table after toggling the button state
        });
    });

    function toggleButton(buttonId) {
        const button = document.getElementById(buttonId);
        const isOn = button.classList.contains('button-on');

        if (isOn) {
            button.classList.remove('button-on');
            button.classList.add('button-off');
            localStorage.setItem(buttonId, 'off');
        } else {
            button.classList.remove('button-off');
            button.classList.add('button-on');
            localStorage.setItem(buttonId, 'on');
        }
    }

    // Initial table load
    refreshTable();
});

async function refreshTable() {
    // Button IDs for locations, activities, and instructors
    const locationButtons = ['button1', 'button4', 'button7'];
    const activityButtons = ['button2', 'button5', 'button8'];
    const instructorButtons = ['button3', 'button6', 'button9'];
    
    // Arrays to store checked items from localStorage
    let unionOfLocations = new Set();
    let checkedActivities = new Set();
    let checkedInstructors = new Set();
    let anyLocationButtonOn = false;
    let anyActivityButtonOn = false;
    let anyInstructorButtonOn = false;

    // Retrieve and combine checked locations from buttons 1, 4, and 7
    locationButtons.forEach(buttonId => {
        const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage

        if (buttonState === 'on') {
            anyLocationButtonOn = true; // At least one location button is 'on'
            const checkedLocations = JSON.parse(localStorage.getItem(`checkedItems_${buttonId}`)) || [];
            checkedLocations.forEach(location => unionOfLocations.add(location)); // Add locations to the union set
        }
    });

    // Retrieve and combine checked activities from buttons 2, 5, and 8 if they are 'on'
    activityButtons.forEach(buttonId => {
        const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage
        if (buttonState === 'on') {
            anyActivityButtonOn = true; // At least one activity button is 'on'
            const checkedItems = JSON.parse(localStorage.getItem(`checkedItems_${buttonId}`)) || [];
            checkedItems.forEach(activity => checkedActivities.add(activity)); // Add activities to the set
        }
    });

    // Retrieve and combine checked instructors from buttons 3, 6, and 9 if they are 'on'
    instructorButtons.forEach(buttonId => {
        const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage
        if (buttonState === 'on') {
            anyInstructorButtonOn = true; // At least one instructor button is 'on'
            const checkedItems = JSON.parse(localStorage.getItem(`checkedItems_${buttonId}`)) || [];
            checkedItems.forEach(instructor => checkedInstructors.add(instructor)); // Add instructors to the set
        }
    });


    // Determine if location filtering should be applied
    let uniqueLocationsArray;
    if (anyLocationButtonOn && unionOfLocations.size > 0) {
        uniqueLocationsArray = Array.from(unionOfLocations); // Use the union set of locations if any locations are selected
    } else {
        uniqueLocationsArray = getAllLocations(); // Use the full list of locations if no location filter is applied
    }

    // Fetch data based on the locations
    const rawData = await fetchAllData(uniqueLocationsArray);
    const transformedData = rawData.map(item => transformItem(item));

    // Filter the data based on activities and instructors only if their buttons are 'on' and they have selected items
    const filteredData = transformedData.filter(item => {
        const activityMatches = !anyActivityButtonOn || checkedActivities.size === 0 || checkedActivities.has(item.activity);  // Match all if no activities are checked
        const instructorMatches = !anyInstructorButtonOn || checkedInstructors.size === 0 || checkedInstructors.has(item.instructor);  // Match all if no instructors are checked
    
        return activityMatches && instructorMatches;  // Include items that match both filters, if applied
    });

    const sortedData = filteredData.sort((a, b) => a.date - b.date);

    // Get table body and clear existing rows
    const tableBody = document.querySelector('.table tbody');
    tableBody.innerHTML = "";    

    // Populate the table with new data
    sortedData.forEach(item => {
        const newRow = document.createElement('tr');

        // Create a new cell for each field
        const dateCell = document.createElement('td');
        dateCell.textContent = item.startTime;

        const locationCell = document.createElement('td');
        locationCell.textContent = item.location;

        const activityCell = document.createElement('td');
        activityCell.textContent = item.activity;

        const instructorCell = document.createElement('td');
        instructorCell.textContent = item.instructor;

        // Append cells to the row
        newRow.appendChild(dateCell);
        newRow.appendChild(locationCell);
        newRow.appendChild(activityCell);
        newRow.appendChild(instructorCell);

        // Append the row to the table body
        tableBody.appendChild(newRow);
    });    

}
