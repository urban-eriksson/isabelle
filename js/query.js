import {gyms} from './gymsData.js'

async function fetchData(businessUnit) {
    const now = Date.now();
    const start = (new Date(now)).toISOString().replaceAll(":", "%3A");
    const end = (new Date(now + 518400000)).toISOString().substring(0, 10) + "T21%3A59%3A59.999Z"    
    const url = `https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/${businessUnit}/groupactivities?period.end=${end}&period.start=${start}&webCategory=22`;
    const response = await fetch(url);
    return response.json();
}

// Function to convert locations to IDs
function getGymIdsFromLocations(locations) {
    return gyms
        .filter(gym => locations.includes(gym.location))  // Filter gyms by matching locations
        .map(gym => gym.id);  // Map the filtered gyms to their IDs
}    


export async function fetchAllData(locationsArray) {
    const gymIds = getGymIdsFromLocations(locationsArray);
    return (await Promise.all(gymIds.map(id => fetchData(id)))).flat()
}

export function transformItem(item) {
    const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    console.log(item);
    var date = new Date(item.duration.start);
    const zeroPad = (num, places) => String(num).padStart(places, '0')
    const location = item.businessUnit.name.replace("Stockholm -", "")
    let name = "---"
    if (item.instructors.length > 0) {
        name = item.instructors[0].name
    }
    if (item.instructors.length > 1) {
        name += ' m. fl.'
    }

    return { date: date, type: item.name, location: location, name, startTime: `${days[date.getDay()]} ${zeroPad(date.getDate(), 2)} ${months[date.getMonth()]}. ${zeroPad(date.getHours(), 2)}:${zeroPad(date.getMinutes(), 2)}` }
}

export function get_locations() {
    return gyms.map(gym => gym.location)
}


export async function loadIntoTable(businessUnits, table) {
    const allData = (await Promise.all(businessUnits.map(bu => fetchData(bu)))).flat()
    const filteredData = filterData(allData);
    const transformedData = filteredData.map(item => transformItem(item));
    const sortedData = transformedData.sort((a, b) => a.date - b.date);
    console.log(sortedData)

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

        const instructor = document.createElement("td");
        instructor.textContent = item.instructor;
        rowElement.appendChild(instructor);


        tableBody.appendChild(rowElement);
    }
}



function filterData(data) {
    return data;
    // return data.filter(item => item.instructors.some(instructor => instructor.name == "Isabelle Badéa"));
}
