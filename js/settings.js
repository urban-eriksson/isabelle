// settings.js

import { getAllLocations, getActivities, getInstructors } from './query.js'

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
        refreshTable(lastPressedButtonId);
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

async function refreshTable(selectedButtonId) {
    let items = [];
    
    // Determine what to display based on the selected button
    if (['button2', 'button5', 'button8'].includes(selectedButtonId)) {
        items = await getActivities();  // Get activities if button 2, 5, or 8 is pressed
    } else if (['button3', 'button6', 'button9'].includes(selectedButtonId)) {
        items = await getInstructors();  // Get instructors if button 3, 6, or 9 is pressed
    } else {
        items = getAllLocations();  // Default to locations if none of the above
    }
    
    // Retrieve checked locations for the selected button from localStorage
    let checkedItems = JSON.parse(localStorage.getItem(`checkedItems_${selectedButtonId}`)) || [];
    
    const tableBody = document.querySelector('.table tbody');

    // Clear existing rows
    tableBody.innerHTML = '';

    // Populate the table with the items (activities, instructors, or locations)
    items.forEach(item => {
        const newRow = document.createElement('tr');

        // Create a new cell for the checkbox
        const checkboxCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checkedItems.includes(item); 

        // Add an event listener to update localStorage when the checkbox is toggled
        checkbox.addEventListener('change', function() {
            // If the checkbox is checked, add the item to the array
            if (checkbox.checked) {
                checkedItems.push(item);
            } else {
                // If unchecked, remove the item from the array
                checkedItems = checkedItems.filter(i => i !== item);
            }
            // Update the localStorage with the modified array
            localStorage.setItem(`checkedItems_${selectedButtonId}`, JSON.stringify(checkedItems));
        });    

        checkboxCell.appendChild(checkbox);  // Add the checkbox to the cell
        newRow.appendChild(checkboxCell);    // Add the checkbox cell to the row

        // Create a new cell for the item text
        const itemCell = document.createElement('td');
        itemCell.textContent = item; // Set the cell's text content to the item (location, activity, or instructor
        newRow.appendChild(itemCell);    // Add the item cell to the row

        // Append the new row to the table body        
        tableBody.appendChild(newRow);
    });
}