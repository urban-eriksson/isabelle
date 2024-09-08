import {fetchAllData, transformItem, get_locations} from './query.js'

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
    // Button IDs we are interested in (1, 4, and 7)
    const buttonsToCheck = ['button1', 'button4', 'button7'];
    
    // Array to store the union of locations
    let unionOfLocations = new Set();
    let anyButtonOn = false;

    // Iterate over each button and check if it's in the 'on' state
    buttonsToCheck.forEach(buttonId => {
        const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage

        if (buttonState === 'on') {
            anyButtonOn = true; // At least one button is 'on'
            // Retrieve checked locations for this button from localStorage
            const checkedLocations = JSON.parse(localStorage.getItem(`checkedLocations_${buttonId}`)) || [];
            
            // Add these locations to the union set
            checkedLocations.forEach(location => unionOfLocations.add(location));
        }
    });

    // If none of the buttons 1, 4, or 7 are 'on', use the full list of locations
    let uniqueLocationsArray;
    if (!anyButtonOn) {
        uniqueLocationsArray = get_locations(); // Get the full list of locations
    } else {
        uniqueLocationsArray = Array.from(unionOfLocations); // Use the union set of locations
    }

    // Call fetchAllData with the unique union of locations
    const rawData = await fetchAllData(uniqueLocationsArray);
    const transformedData = rawData.map(item => transformItem(item));
    const sortedData = transformedData.sort((a, b) => a.date - b.date);

    // Get table body and clear existing rows
    const tableBody = document.querySelector('.table tbody');
    tableBody.innerHTML = "";    

    // Populate the table with new data
    sortedData.forEach(item => {
        const newRow = document.createElement('tr');

        // Create a new cell for each field
        const dateCell = document.createElement('td');
        dateCell.textContent = item.startTime;

        const typeCell = document.createElement('td');
        typeCell.textContent = item.type;

        const locationCell = document.createElement('td');
        locationCell.textContent = item.location;

        const instructorCell = document.createElement('td');
        instructorCell.textContent = item.name;

        // Append cells to the row
        newRow.appendChild(dateCell);
        newRow.appendChild(typeCell);
        newRow.appendChild(locationCell);
        newRow.appendChild(instructorCell);

        // Append the row to the table body
        tableBody.appendChild(newRow);
    });    

}
