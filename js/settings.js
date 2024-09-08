// settings.js

import { get_locations } from './query.js'

document.addEventListener('DOMContentLoaded', function() {
    // Add event listener to the back icon
    const backIcon = document.getElementById('back-icon');
    
    if (backIcon) {  // Ensure the element exists before adding the event listener
        backIcon.addEventListener('click', function() {
            window.location.href = 'index.html'; // Redirects to the index page
        });
    }



    // Retrieve the last pressed button ID from localStorage
    const lastPressedButtonId = localStorage.getItem('lastPressedButtonId');

    if (lastPressedButtonId) {
        // Find the button with the stored ID and change its background color to red
        const lastPressedButton = document.getElementById(lastPressedButtonId);
        if (lastPressedButton) {
            lastPressedButton.style.backgroundColor = 'red';
        }
    }

    // Add event listeners to buttons to update localStorage and call refreshTable
    const buttons = document.querySelectorAll('.toggle-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Store the ID of the clicked button in localStorage
            localStorage.setItem('lastPressedButtonId', button.id);

            // Update the button styles
            buttons.forEach(btn => btn.style.backgroundColor = ''); // Reset all button colors
            button.style.backgroundColor = 'red'; // Highlight the clicked button

            // Call the refreshTable function when a button is clicked
            refreshTable(button.id);            
        });
    });
});

function refreshTable(selectedButtonId) {
    // Call the get_locations function from query.js
    const locations = get_locations();
    
    // Retrieve checked locations for the selected button from localStorage
    let checkedLocations = JSON.parse(localStorage.getItem(`checkedLocations_${selectedButtonId}`)) || [];
    
    const tableBody = document.querySelector('.table tbody');

    // Clear existing rows
    tableBody.innerHTML = '';

    // Populate the table with locations
    locations.forEach(location => {
        const newRow = document.createElement('tr');

        // Create a new cell for the checkbox
        const checkboxCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checkedLocations.includes(location); 

        // Add an event listener to update localStorage when the checkbox is toggled
        checkbox.addEventListener('change', function() {
            // If the checkbox is checked, add the location to the array
            if (checkbox.checked) {
                checkedLocations.push(location);
            } else {
                // If unchecked, remove the location from the array
                checkedLocations = checkedLocations.filter(loc => loc !== location);
            }
            // Update the localStorage with the modified array
            localStorage.setItem(`checkedLocations_${selectedButtonId}`, JSON.stringify(checkedLocations));
        });    

        checkboxCell.appendChild(checkbox);  // Add the checkbox to the cell
        newRow.appendChild(checkboxCell);    // Add the checkbox cell to the row

        // Create a new cell for the location text
        const locationCell = document.createElement('td');
        locationCell.textContent = location; // Set the cell's text content to the location name
        newRow.appendChild(locationCell);    // Add the location cell to the row

        // Append the new row to the table body        
        tableBody.appendChild(newRow);
    });
}