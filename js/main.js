document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', function() {
        this.style.backgroundColor = this.style.backgroundColor === 'red' ? 'grey' : 'red';
    });
});