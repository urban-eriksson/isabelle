async function loadIntoTable(url, table) {

    const tableBody = table.querySelector("tbody");

    const response = await fetch(url);
    console.log(response);

    const items = await  response.json();
    console.log(items);

    tableBody.innerHTML="";

    for (const item of items) {

        //console.log(item["instructors"]);

        for (const instructor of item["instructors"]) {
            console.log(instructor["name"]);
            if (instructor["name"] == "Isabelle Badéa") {
                const rowElement = document.createElement("tr");

                const pass = document.createElement("td");
                pass.textContent = item["name"];
                rowElement.appendChild(pass);
                
                const lokal = document.createElement("td");
                lokal.textContent = item["businessUnit"]["name"];
                rowElement.appendChild(lokal);

                const tid = document.createElement("td");
                tid.textContent = item["duration"]["start"];
                rowElement.appendChild(tid);
        
                tableBody.appendChild(rowElement);        
            }

        }





    }

}


loadIntoTable("https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/6235/groupactivities?period.end=2023-01-05T22%3A59%3A59.999Z&period.start=2022-12-29T23%3A00%3A00.000Z&webCategory=22" , document.querySelector("table"))