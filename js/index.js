import {fetchAllData, transformItem, getAllLocations} from './api.js'

document.addEventListener('DOMContentLoaded', function() {
    const infoIcon = document.getElementById('info-icon');
    if (infoIcon) {
        infoIcon.addEventListener('click', function() {
            window.location.href = 'manual.html'; // Redirect to the manual page
        });
    }

    const settingsIcon = document.getElementById('settings-icon');
    if (settingsIcon) {
        settingsIcon.addEventListener('click', function() {
            window.location.href = 'filter-settings.html'; // Redirects to the settings page
        });
    }

    // Array of button ids
    const buttonIds = ['button1', 'button2', 'button3','button4', 'button5', 'button6','button7', 'button8', 'button9'];

    const buttons = buttonIds.map(id => document.getElementById(id)); // Map button ids to DOM elements

    // Initialize or load button states
    buttons.forEach(button => {
        const storedState = localStorage.getItem(button.id);

        if (storedState === 'on') {
            button.classList.add('active');
        }

        // Adding click event listener to toggle state
        button.addEventListener('click', () =>  {
            // Toggle the button's state
            toggleButton(button.id);
            refreshTable(); // Refresh the table after toggling the button state
        });
    });

    // Toggle button state function
    function toggleButton(buttonId) {
        const button = document.getElementById(buttonId);
        const isActive = button.classList.contains('active');

        if (isActive) {
            button.classList.remove('active'); // Remove 'active' state
            localStorage.setItem(buttonId, 'off');
        } else {
            button.classList.add('active'); // Add 'active' state
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

    // Helper function to retrieve and combine checked items from buttons
    const getCheckedItemsFromStorage = (buttons) => {
        let combinedSet = new Set();
        let anyButtonOn = false;

        buttons.forEach(buttonId => {
            const buttonState = localStorage.getItem(buttonId); // Retrieve 'on' or 'off' from localStorage
            if (buttonState === 'on') {
                anyButtonOn = true;
                const storedCheckedItems = JSON.parse(localStorage.getItem(`checkedItems_${buttonId}`)) || [];
                storedCheckedItems.forEach(item => combinedSet.add(item));
            }
        });

        return { combinedSet, anyButtonOn };
    };

    // Retrieve and combine checked locations, activities, and instructors
    const { combinedSet: unionOfLocations, anyButtonOn: anyLocationButtonOn } = getCheckedItemsFromStorage(locationButtons);
    const { combinedSet: checkedActivities, anyButtonOn: anyActivityButtonOn } = getCheckedItemsFromStorage(activityButtons);
    const { combinedSet: checkedInstructors, anyButtonOn: anyInstructorButtonOn } = getCheckedItemsFromStorage(instructorButtons);

    // Determine if location filtering should be applied
    let uniqueLocationsArray = (anyLocationButtonOn && unionOfLocations.size > 0)
        ? Array.from(unionOfLocations)
        : getAllLocations(); // Use the full list of locations if no filter is applied

    // Fetch data based on the locations
    const rawData = await fetchAllData(uniqueLocationsArray);
    const transformedData = rawData.map(item => transformItem(item));

    // Filter the data based on activities and instructors only if their buttons are 'on' and they have selected items
    const filteredData = transformedData.filter(item => {
        const activityMatches = !anyActivityButtonOn || checkedActivities.size === 0 || checkedActivities.has(item.activity);  // Match all if no activities are checked
        const instructorMatches = !anyInstructorButtonOn || checkedInstructors.size === 0 || checkedInstructors.has(item.instructor);  // Match all if no instructors are checked
        return activityMatches && instructorMatches;  // Include items that match both activity and instructor if active
    });

    const sortedData = filteredData.sort((a, b) => a.date - b.date);

    // Get table body and clear existing rows
    const tableBody = document.querySelector('.table tbody');
    tableBody.innerHTML = "";    

    // Populate the table with new data
    sortedData.forEach(item => {
        const newRow = document.createElement('tr');

        // Create and append new cells for each field
        ['startTime', 'location', 'activity', 'instructor'].forEach(field => {
            const cell = document.createElement('td');
            cell.textContent = item[field];
            newRow.appendChild(cell);
        });

        tableBody.appendChild(newRow);
    });    
}
