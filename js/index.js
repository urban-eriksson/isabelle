

function get_something() {
    return something;
}

async function fetchData(businessUnit) {
    const now = Date.now();
    const start = (new Date(now)).toISOString().replaceAll(":", "%3A");
    const end = (new Date(now + 518400000)).toISOString().substring(0, 10) + "T21%3A59%3A59.999Z"    

    const url = `https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/${businessUnit}/groupactivities?period.end=${end}&period.start=${start}&webCategory=22`;

    const response = await fetch(url);
    return response.json();
}


function filterData(data) {
    return data.filter(item => item.instructors.some(instructor => instructor.name == "Isabelle Badéa"));
}


function transformItem(item) {
    const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    console.log(item);
    var date = new Date(item.duration.start);
    const zeroPad = (num, places) => String(num).padStart(places, '0')
    const location = item.businessUnit.name.replace("Stockholm -", "")
    return { date: date, type: item.name, location: location, startTime: `${days[date.getDay()]} ${zeroPad(date.getDate(), 2)} ${months[date.getMonth()]}. ${zeroPad(date.getHours(), 2)}:${zeroPad(date.getMinutes(), 2)}` }
}



async function loadIntoTable(businessUnits, table) {
    const allData = (await Promise.all(businessUnits.map(bu => fetchData(bu)))).flat()
    const filteredData = filterData(allData);
    const transformedData = filteredData.map(item => transformItem(item));
    const sortedData = transformedData.sort((a, b) => a.date - b.date);

    const tableBody = table.querySelector("tbody");
    tableBody.innerHTML = "";

    for (const item of sortedData) {
        const rowElement = document.createElement("tr");

        const type = document.createElement("td");
        type.textContent = item.type;
        rowElement.appendChild(type);

        const location = document.createElement("td");
        location.textContent = item.location;
        rowElement.appendChild(location);

        const startTime = document.createElement("td");
        startTime.textContent = item.startTime;
        rowElement.appendChild(startTime);

        tableBody.appendChild(rowElement);
    }
}

var button = document.getElementById('button1');
var color = button.style.backgroundColor;
button.addEventListener('click', function () {
  // this function executes whenever the user clicks the button
  color = button.style.backgroundColor = color === 'green' ? 'red' : 'green';
});

businessUnits = [6232, 6235]
loadIntoTable(businessUnits, document.querySelector("table"))
get_something()