



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
    if (data !== ''){
    // var span = document.getElementById('resTextlt');
    var node=document.createElement("li");
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

// var form = document.getElementById('new_cat');
// form.addEventListener('submit', addSubmit);


// //Collapsible control
// var coll = document.getElementsByClassName("collapsible");
// var i;

// for (i = 0; i < coll.length; i++) {
//   coll[i].addEventListener("click", function() {
//     this.classList.toggle("active");
//     var content = this.nextElementSibling;
//     if (content.style.display === "block") {
//       content.style.display = "none";
//     } else {
//       content.style.display = "block";
//     }
//   });
// }