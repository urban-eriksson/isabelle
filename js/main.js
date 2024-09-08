import {fetchAllData, transformItem} from './query.js'


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
        button.addEventListener('click', () => toggleButton(id));
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

    refreshTable();
});

async function refreshTable() {
    // Button IDs we are interested in (1, 4, and 7)
    const buttonsToCheck = ['button1', 'button4', 'button7'];
    
    // Array to store the union of locations
    let unionOfLocations = new Set();

    // Iterate over each button and check if it's in the 'on' state
    buttonsToCheck.forEach(buttonId => {
        const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage

        if (buttonState === 'on') {
            // Retrieve checked locations for this button from localStorage
            const checkedLocations = JSON.parse(localStorage.getItem(`checkedLocations_${buttonId}`)) || [];
            
            // Add these locations to the union set
            checkedLocations.forEach(location => unionOfLocations.add(location));
        }
    });

    // Convert the Set back to an array
    const uniqueLocationsArray = Array.from(unionOfLocations);

    // Call fetchAllData with the unique union of locations
    const rawData = await fetchAllData(uniqueLocationsArray);
    const transformedData = rawData.map(item => transformItem(item));
    const sortedData = transformedData.sort((a, b) => a.date - b.date);


    const tableBody = document.querySelector('.table tbody');
    tableBody.innerHTML = "";    

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



