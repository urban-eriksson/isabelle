// document.querySelectorAll('.toggle-btn').forEach(button => {
//     button.addEventListener('click', function() {
//         this.style.backgroundColor = this.style.backgroundColor === 'red' ? 'grey' : 'red';
//     });
// });


document.addEventListener('DOMContentLoaded', function() {
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
});