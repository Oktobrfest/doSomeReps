



function highlight(x) {
    x.style.borderStyle = "dotted solid double dashed";
    // new window.FlashMessage('This is a successs flash message !', 'success');
}

function unhighlight(x) {
    x.style.borderStyle;
}



// var h_add = flask_util_js.url_for('home.add');
// //var h_add = flask_util.url_for('home.add');
var h_add = flask_util.url_for('home.add');

function addSubmit(ev) {
    ev.preventDefault();
    console.log(ev);
    fetch(h_add, {
        method: 'POST',
        body: new FormData(this)
    })
        .then(parseJSON)
        .then(addShow);
}

function parseJSON(response) {
    return response.json();
}

function addShow(data, htl) {
    if ((data !== '') && (data[0] !== '')) {
        // var span = document.getElementById('resTextlt');
        var node = document.createElement("li");
        node.className = 'list-group-item'

        var checkbox = document.createElement('input');
        chkbox_name = 'cat_' + data[1] + '_chkbox';
        checkbox.type = "checkbox";
        checkbox.name = chkbox_name;
        checkbox.value = "True";
        checkbox.id = chkbox_name;

        var label = document.createElement('label')
        label.htmlFor = chkbox_name;
        // didnt work label_txt = '  ' + data
        str1 = '.  '
        const label_txt = str1.concat('    ', data[0]);
        label.appendChild(document.createTextNode(label_txt));
        n = document.getElementById("categories").appendChild(node);
        n.appendChild(checkbox);
        n.appendChild(label);
    }
}


// bind only once attempt#1
//  didnt work : document.onload = runOnce(document);
document.addEventListener('readystatechange', event => {

    // When HTML/DOM elements are ready:
    // if (event.target.readyState === "interactive") {   //does same as:  ..addEventListener("DOMContentLoaded"..
    //     runOnce(document);
    // }

    // When window loaded ( external resources are loaded too- `css`,`src`, etc...) 
    if (event.target.readyState === "complete") {
        runOnce(document);
    }
});

function runOnce(document) {
    var form = document.getElementById('new_cat');
    if (form) {
        form.addEventListener('submit', addSubmit, {
            once: true,
        });
    }
};

// attach the event listener to the button
// function bindlistener(document) {
//     var frm = document.getElementById('startquizform');
//     if (frm) {

//         frm.addEventListener('submit', start_qz, {
//             once: true,
//         });
//     }
// };

window.addEventListener('load', () => {
    bindlistener(document);
  });

// get quiz page url VIA url_for
var quiz_page = flask_util.url_for('home.quiz');

// make the submission
function start_qz(ev) {
    ev.preventDefault();

    // Get the checkbox elements
    const checkboxes = document.querySelectorAll('input[type=checkbox]');
    // Get the selected categories form element
    const selected_catz1 = document.getElementById('categories');
    // Create a JavaScript object to store the data
    const selected_boxes = [];

    // Iterate over the checkboxes and add the checked ones to the object
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selected_boxes.push(checkbox.value);
        }
    });

    // Convert the JavaScript object to a JSON string
    const selected_catz = JSON.stringify(selected_boxes);

    console.log(ev);

    fetch(quiz_page, {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/json'
          },
        body: selected_catz
    })
    // .then(parseJSON)
    // .then(addShow);
}

