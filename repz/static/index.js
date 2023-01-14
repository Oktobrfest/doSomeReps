



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

// window.addEventListener('load', () => {
//     bindlistener(document);
//   });

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


// function toggleSidebar() {
//     var sidebar = document.getElementById("sidebar");
//     var isCollapsed = sidebar.classList.contains("collapsed");
//     sidebar.classList.toggle("collapsed", !isCollapsed);
//   }

//   window.addEventListener('load', function() {
//     document.getElementById('sidebarCollapse').addEventListener('click', function() {
//       document.getElementById('sidebar').classList.toggle('active');
//     });
//   });




//  ACTUALLY RUNS JUST ONCE!!! 
window.onload = (event) => {
    const showHideButton = document.getElementById('collapse-categories-button');
    if (showHideButton) {
        showHideButton.onclick = function () { hideShowChange(showHideButton) };
    };

    // select the search form
    const filterform = document.getElementById('search-filters-form');
    // select the search button
    const searchbutton = document.getElementById('search-button');
    // process the search
    if (searchbutton) {
        searchbutton.onclick = function () { getSearchData(filterform) };
    };

}

var searchq = flask_util.url_for('home.searchq');

// submit search form data via json to backend
function getSearchData(filterform) {

    // get categories
    const search_categories = document.querySelectorAll('.search-filter-categories input[type=checkbox]');
    console.log(search_categories);

    const selected_search_categories = [];
    search_categories.forEach(checkbox => {
        if (checkbox.checked) {
            selected_search_categories.push(checkbox.value);
        }
    });
    // get search within checkboxes
    const search_within_checkboxes = document.querySelectorAll('.search-within-categories input[type=checkbox]');
    console.log(search_within_checkboxes);

    const selected_search_within = [];
    search_within_checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selected_search_within.push(checkbox.value);
        }
    });

    // get search query
    const search_val = document.getElementById('search-terms').value;

    // aggregate the forms values
    const search_values = {
        'search-terms': search_val,
        'search-categories': selected_search_categories,
        'search-within': selected_search_within
    };


    // Convert the JavaScript object to a JSON string
    const search_criteria = JSON.stringify(search_values);
    console.log(search_criteria);

    fetch(searchq, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: search_criteria
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // add search results to the sidebar
            data.forEach(function (item) {

                let li = document.createElement('li');
                li.className = 'question-result-list-item list-group-item list-group-item-action list-group-item-light'

                let text = document.createTextNode(item.question_name);
                // Append the text to <div>
                li.appendChild(text);

                let ul = document.createElement('ul');
                ul.className = "list-inline";
                ul.setAttribute('data-value', item.question_id);
                // append categories as a list
                item.categories.forEach(function (data) {

                    let cat_li = document.createElement('li');
                    cat_li.className = 'list-inline-item list-group-item-secondary list-group-item-sm text-center questions-category search-result-category-item'
                    let cat_text = document.createTextNode(data);
                    cat_li.appendChild(cat_text);

                    cat_li.setAttribute('data-value', item.question_id);

                    ul.appendChild(cat_li);

                });

                li.appendChild(ul);

                var hidden = document.createElement('input');
                hidden_name = item.question_id;
                hidden.type = "hidden";
                hidden.name = item.question_id;
                hidden.value = item.question_id;
                hidden.id = item.question_id;;
                hidden.setAttribute('data-value', item.question_id);
                li.setAttribute('data-value', item.question_id);

                li.appendChild(hidden);

                li.addEventListener('click', populateQuestion);


                n = document.getElementById("search-results-list-unstyled").appendChild(li);


            });
        })
        .catch(error => {
            console.log(error);
        });

};

var getq = flask_util.url_for('home.getq');

function populateQuestion(event) {
    var question_id = event.target.dataset.value;
    console.log(question_id);

    fetch(getq, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: question_id
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // populate edit question area
            console.log(data);
            // uncover the hidden area
            const question_area = document.getElementById("editquestionform-area");
            question_area.style.display = "block";

            // populate the forms
            document.getElementById("question_name").value = data.question_name;
            document.getElementById("question_text").value = data.question_text;
            document.getElementById("hint").value = data.hint;
            document.getElementById("answer").value = data.answer;

            // Get the element with class "edit-question-title"
            var title_heading = document.querySelector("#edit-question-title-heading");

            // Append some text to the element
            title_heading.innerHTML += data.question_name;

            // Handle images
            // loop through the image strings in the "pics_by_type" object
            for (let picType in data.pics_by_type) {
                for (let i = 0; i < data.pics_by_type[picType].length; i++) {
                    // create an <img> element for each image string
                    let img = document.createElement("img");
                    var pic_url = data.pics_by_type[picType][i].pic_string;
                    img.src = pic_url;

                    img.alt = picType; // add the picType as the alt text
                    var pic_id = data.pics_by_type[picType][i].pic_id;
                    img.id = pic_id;
                    img.baseURI = "https://reppics.s3.us-west-2.amazonaws.com"
                    // add the image to the right spot
                    if (picType === "question") {
                        let imgContainer = createImgContainer(pic_id);
                        const question_image = document.getElementById("upload_question_image");
                        imgContainer.appendChild(img);

                        
                        question_image.appendChild(imgContainer);
                    }

                }
            }

            function createImgContainer(pic_id) {
                let div = document.createElement("div");
                div.className = "image-container";
                // make close image button
                var button = document.createElement('input');
                button_name = 'pic-' + pic_id + '-close-button';
                button.type = "button";
                button.name = button_name;
                button.value = button_name;
                button.id = button_name;
                button.setAttribute('data-value', pic_id);
                button.className = "image-close-button";
                button.addEventListener('click', eliminateImage);
                div.appendChild(button);
                return div;
            }


        })
        .catch(error => {
            console.log(error);
        });





}

function eliminateImage(event) {
    var pic_id = event.target.dataset.value;
    console.log(pic_id);
    var pic = document.getElementById(pic_id);
    pic.remove();
    var button = document.getElementById('pic-' + pic_id + '-close-button');
    button.remove();
};

function hideShowChange(button) {
    if (button.textContent === 'Hide Filters') {
        button.textContent = 'Show Filters';
    } else {
        button.textContent = 'Hide Filters';
    }
}






