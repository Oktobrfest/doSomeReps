
function highlight(x) {
    x.style.borderStyle = "dotted solid double dashed";
    // new window.FlashMessage('This is a successs flash message !', 'success');
}

function unhighlight(x) {
    x.style.borderStyle;
}

var h_add = flask_util.url_for('home.add');

function addSubmit(ev) {
    ev.preventDefault();
    //  console.log(ev);
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


// get quiz page url VIA url_for
var quiz_page = flask_util.url_for('home.quiz');

// make the submission
function start_qz(ev) {
    ev.preventDefault();
    // Get the checkbox elements
    const checkboxes = document.querySelectorAll('input[type=checkbox]');
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
    // console.log(ev);
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

    // grab ALL the collapse buttons
    const collapseButtons = document.querySelectorAll('#collapse-button');
    // loop through them and add the event listener
    collapseButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            hideShowChange(button);
        });
    });

    if (window.location.pathname === '/') {
        // unfavorate button
        const unfavorite_button = document.querySelectorAll(".unfavorite-user-button");
        unfavorite_button.forEach(function (button) {
            button.addEventListener('click', unFavoriteUser);
        });
        // unblock button
        const unblock_button = document.querySelectorAll(".unblock-user-button");
        unblock_button.forEach(function (button) {
            button.addEventListener('click', unBlockUser);
        });
    }

    if (window.location.pathname === '/quemore') {
        const que_more_search = document.querySelector("#que-more-search-button");
        que_more_search.addEventListener('click', queMoreSearch);

        const que_qty_field = document.getElementById('qty_to_que');
        que_qty_field.value = 10;

        const save_to_que_button = document.querySelector("#save-to-que");
        save_to_que_button.addEventListener('click', saveToQue);




    }
    // const showHideButton = document.getElementById('collapse-button');
    // if (showHideButton) {
    //     showHideButton.onclick = function (event) {
    //         event.preventDefault();
    //         hideShowChange(showHideButton);
    //     };
    // }
    // exclude other pages from loading this
    if (window.location.pathname === '/editquestions') {
        // select the search form
        const filterform = document.getElementById('search-filters-form');
        // select the search button
        const searchbutton = document.getElementById('search-button');
        searchbutton.addEventListener('click', clearMsgArea);
        // process the search
        if (searchbutton) {
            searchbutton.onclick = function () { getSearchData(filterform) };
        };
        const save_question_button = document.querySelector("#save-question-button");
        save_question_button.addEventListener('click', clearMsgArea);
    }

    if (window.location.pathname === '/quiz') {
        const add_favorite_button = document.querySelector("#favorite-user-button");
        add_favorite_button.addEventListener('click', addFavoriteUser);
    }
}
var searchq = flask_util.url_for('home.searchq');

// submit search form data via json to backend
function getSearchData(filterform) {
    // clear old question form
    clearForm();
    hideQuestionArea();

    // First clear out the old question list results
    const previous_search_results = document.querySelectorAll('.question-result-list-item');
    // use remove() to remove each of elements from the DOM
    previous_search_results.forEach(element => { element.remove() });

    // get categories
    const search_categories = document.querySelectorAll('.search-filter-categories input[type=checkbox]');

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
                li.addEventListener('click', clearMsgArea);
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
    clearForm();
    clearMsgArea();
    var question_id = event.target.dataset.value;

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
            // uncover the hidden area
            const question_area = document.getElementById("editquestionform-area");
            question_area.style.display = "block";
            // one time only, set the save button event listener and delete button
            const save_question_button = document.querySelector("#save-question-button");
            save_question_button.addEventListener('click', saveQuestion, {
                once: true,
            });
            const delete_question_button = document.querySelector("#delete-question-button");
            delete_question_button.addEventListener('click', deleteQuestion, {
                once: true,
            });
            // clear out the previous forms pictures
            clearPics();
            // populate the forms
            document.getElementById("question_name").value = data.question_name;
            document.getElementById("question_text").value = data.question_text;
            document.getElementById("hint").value = data.hint;
            document.getElementById("answer").value = data.answer;
            document.getElementById("question-id").value = data.id;
            document.getElementById("privacy-checkbox").checked = data.privacy;
            // get list of categories
            // console.log(data['categories']);
            // loop through the categories and check the checkboxes
            data['categories'].forEach(function (item) {
                const checkbox = document.querySelector('#editquestionform-area input[type="checkbox"][value="' + item + '"]');
                checkbox.checked = true;
            });

            const submitBtn = document.getElementsByClassName('question-submit-button')[0];
            const autoQue = document.getElementById('auto-que-checkbox-section');

            // Set its display property to none
            submitBtn.style.display = 'none';
            autoQue.style.display = 'none';

            // const save_question_button = document.querySelector("#save-question-button");
            // save_question_button.dataset.questionButton = data.question_id;
            // Get the element with class "edit-question-title"
            var title_heading = document.querySelector("#edit-question-title-heading");
            // Append some text to the element
            title_heading.innerHTML = data.question_name;
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
                    let imgContainer = createImgContainer(pic_id);
                    imgContainer.appendChild(img);

                    // formulate element ID to put img in the right spot
                    let imgLocationID = "upload-" + picType + "-image";
                    let question_image = document.getElementById(imgLocationID);
                    question_image.appendChild(imgContainer);
                }
            }
        })
        .catch(error => {
            console.log(error);
        });
}

function createImgContainer(pic_id) {
    let div = document.createElement("div");
    div.className = "image-container";
    div.setAttribute('data-pic-id', pic_id);
    // make close image button
    var button = document.createElement('input');
    button_name = 'pic-' + pic_id + '-close-button';
    button.type = "button";
    button.name = button_name;
    button.value = 'X';
    button.id = button_name;
    button.setAttribute('data-value', pic_id);
    button.className = "image-close-button";
    button.addEventListener('click', eliminateImage);
    div.appendChild(button);
    return div;
}

function eliminateImage(event) {
    let pic_id = event.target.dataset.value;
    let pic_to_eliminate = document.querySelector('[data-pic-id="' + pic_id + '"]');
    pic_to_eliminate.remove();
};

function hideShowChange(button) {
    if (button.textContent === 'Show Filters') {
        button.textContent = 'Hide Filters';
    } else {
        button.textContent = 'Show Filters';
    }
}

var saveq = flask_util.url_for('home.saveq');

function saveQuestion(ev) {
    q = {};
    q.question_name = document.getElementById("question_name").value;
    q.question_text = document.getElementById("question_text").value;
    q.hint = document.getElementById("hint").value;
    q.answer = document.getElementById("answer").value;
    q.id = document.getElementById("question-id").value;
    var checkBox = document.getElementById("privacy-checkbox");
    if (checkBox.checked) {
        q.privacy = true;
    } else {
        q.privacy = false;
    }

    // validation
    if (q.question_name.length < 3) {
        alert("Question name must be at least 3 characters long.");
        return false;
    }
    if (q.question_text.length < 8) {
        alert("Question text must be at least 8 characters long.");
        return false;
    }

    // categories
    let categories = [];
    document.querySelectorAll('#editquestionform-area input[type="checkbox"]:checked').forEach(function (checkbox) {
        categories.push(checkbox.value);
    });
    if (categories.length < 0) {
        alert("Please select at least one category.");
        return false;
    }
    q.categories = categories;

    // get the question images
    let pics_by_type = { "hint": [], "answer": [], "question": [] };
    // assign the pic categories to the above object
    document.querySelectorAll('.image-container img').forEach(function (img) {
        let src = img.getAttribute('src');
        let type = img.getAttribute('alt');
        if (pics_by_type.hasOwnProperty(type)) {
            pics_by_type[type].push(src);
        }
    });
    // assign those pics in the question object that goes to server
    q.pics_by_type = pics_by_type;

    // Create a FormData object and append the file(s)
    const formData = new FormData();

    // get the file input fields and append the files to formData
    const questionImageFiles = document.querySelector('#upload-question-image input[type="file"]').files;
    for (let i = 0; i < questionImageFiles.length; i++) {
        formData.append("question_image", questionImageFiles[i]);
    }

    const hintImageFiles = document.querySelector('#upload-hint-image input[type="file"]').files;
    for (let i = 0; i < hintImageFiles.length; i++) {
        formData.append("hint_image", hintImageFiles[i]);
    }

    const answerImageFiles = document.querySelector('#upload-answer-image input[type="file"]').files;
    for (let i = 0; i < answerImageFiles.length; i++) {
        formData.append("answer_pics", answerImageFiles[i]);
    }

    // append the question object to formData and convert the JavaScript object to a JSON string
    formData.append("updated_question", JSON.stringify(q));

    fetch(saveq, {
        method: 'POST',
        body: formData,
        enctype: 'multipart/form-data'
    })
        .then(response => response.text())
        .then(function () {
            location.reload();
        })
        .then(message => {
            setMsg(message);
        })
}

var deleteq = flask_util.url_for('home.deleteq');

function deleteQuestion(ev) {
    clearMsgArea();
    // Remove the Question from search list
    let val = document.getElementById("question-id").value;
    const element = document.querySelector('[data-value="' + val + '"]');
    element.remove();

    // destructuring assignment!
    const { value: id } = document.getElementById("question-id");
    const delete_q = JSON.stringify({ id });
    clearForm();

    fetch(deleteq, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: delete_q
    }).then(response => response.text())
        .then(message => {
            setMsg(message);
        }).then(hideQuestionArea());
}

function clearPics() {
    // clear out the previous forms pictures
    var picContainers = document.querySelectorAll(".image-container");
    for (let i = 0; i < picContainers.length; i++) {
        picContainers[i].remove();
    }
}

function clearForm() {
    // clear out the previous forms pictures
    clearPics();

    // clear out the categories checkboxes
    const checkboxes = document.querySelectorAll('#editquestionform-area input[type="checkbox"]');
    checkboxes.forEach(function (checkbox) {
        checkbox.checked = false;
    });
    // checkbox.checked = true;

    // clear out the form values
    document.getElementById("question_name").value = "";
    document.getElementById("question_text").value = "";
    document.getElementById("hint").value = "";
    document.getElementById("answer").value = "";
    document.getElementById("question-id").value = "";
    document.getElementById("privacy-checkbox").checked = false;
    document.getElementById("edit-question-title-heading").innerHTML = 'Select a Question';

    // get the file upload fields
    var fileFields = document.querySelectorAll('input[type="file"]');

    // reset each file upload field
    for (var i = 0; i < fileFields.length; i++) {
        fileFields[i].value = null;
    }
}

function clearMsgArea() {
    // Clear old messages out
    let msgArea = document.getElementById("my-message-area");
    msgArea.innerHTML = "";
    msgArea.style.display = "none";
}

function setMsg(message) {
    let msgArea = document.getElementById("my-message-area");
    msgArea.innerHTML = message;
    msgArea.style.display = "block";
}

function hideQuestionArea() {
    // hide question area
    const question_area = document.getElementById("editquestionform-area");
    question_area.style.display = "none";
}

var searchquefilters = flask_util.url_for('home.searchquefilters');

function queMoreSearch(ev) {
    ev.preventDefault();
    // get filter values
    const filters_obj = {
        personal: document.getElementById("personal").checked,
        public: document.getElementById("public").checked,
        favorate: document.getElementById("favorate").checked,
        blocked: document.getElementById("blocked").checked,
        catz: getSelectedCategories()
    };

    // clear old results
    clearTable();

    const filters = JSON.stringify(filters_obj);

    fetch(searchquefilters, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: filters
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.length == 0) {
                let msg = "No questions found.";
                setMsg(msg);
                alert(msg);
                return;
            } else {
                // qty to add counter
                const qty_field = document.getElementById("qty_to_que");
                let que_count = qty_field.value;

                // populate the que search results list
                let table_body = document.getElementById("que-more-search-results-body");
                data.forEach(q => {
                    let row = document.createElement("tr");
                    row.className = "que-more-search-results-row";
                    row.setAttribute('question-id', q.question_id);
                    row.setAttribute('created-by', q.created_by);
                    table_body.appendChild(row);
                    // make cells
                    // que checkbox
                    let que_cell = document.createElement("td");
                    var checkbox = document.createElement('input');
                    chkbox_name = 'que-question-' + q.question_id + '-chkbox';
                    checkbox.type = "checkbox";
                    checkbox.name = chkbox_name;
                    checkbox.value = "True";
                    checkbox.className = "que-question-chkbox question-chkbox";
                    checkbox.id = chkbox_name;
                    que_cell.appendChild(checkbox);
                    row.appendChild(que_cell);

                    // select box counter
                    if (que_count > 0) {
                        que_cell.childNodes[0].checked = true;
                        //  fail: row.que_cell.checkbox.checked = true;
                        console.log("que_count: " + que_count);
                        que_count -= 1;
                    }

                    // exclude checkbox
                    let exclude_cell = document.createElement("td");
                    var checkbox = document.createElement('input');
                    chkbox_name = 'exclude-question-' + q.question_id + '-chkbox';
                    checkbox.type = "checkbox";
                    checkbox.name = chkbox_name;
                    checkbox.value = "True";
                    checkbox.className = "exclude-question-chkbox question-chkbox";
                    checkbox.id = chkbox_name;
                    exclude_cell.appendChild(checkbox);
                    row.appendChild(exclude_cell);
                    // Username
                    let username_cell = document.createElement("td");

                    username_cell.innerHTML = q.username;
                    let blk_button = document.createElement("button");

                    blk_button.className = "btn btn-danger block-button";
                    blk_button.setAttribute('data-blk-user-id', q.created_by);

                    blk_button.addEventListener('click', function (event) {
                        event.preventDefault();
                        blkUser(q.created_by)
                    });

                    // blk_button.addEventListener('click', blkUser(q.created_by));
                    row.appendChild(username_cell);
                    username_cell.appendChild(blk_button);
                    blk_button.innerHTML = "Block";
                    // rating
                    let rating_cell = document.createElement("td");
                    rating_cell.innerHTML = q.rating;
                    row.appendChild(rating_cell);
                    // question text
                    let question_text_td = document.createElement("td");
                    question_text_td.innerHTML = q.question_text;
                    row.appendChild(question_text_td);
                    // categories
                    let catz_cell = document.createElement("td");
                    q.categories.forEach(c => {
                        let catz_span = document.createElement("span");
                        catz_span.className = "badge badge-pill badge-primary";
                        catz_span.innerHTML = c;
                        catz_cell.appendChild(catz_span);
                    });
                    row.appendChild(catz_cell);
                });
            };

        }).catch(error => {
            console.log(error);
        });
}

function getSelectedCategories() {
    // get categories
    const selected_categories = document.querySelectorAll('#categories input[type=checkbox]');

    const selected_search_categories = [];
    selected_categories.forEach(checkbox => {
        if (checkbox.checked) {
            selected_search_categories.push(checkbox.value);
        }
    });

    return selected_search_categories;
}

var unfavorite_user = flask_util.url_for('home.unfavorite_user');

function unFavoriteUser(ev) {
    ev.preventDefault();
    const user_id = ev.target.getAttribute('data-unfav-usr');

    // const formData = new FormData();
    // formData.append('user_id', usr_id);

    fetch(unfavorite_user, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "user_id": user_id })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data == 'ok') {
                // remove the row from the table
                let remove_button = ev.target;
                let user_id_no = remove_button.getAttribute('data-unfav-usr');
                let row_id = "fav-user-id-" + user_id_no + "-row";
                let remove_row = document.getElementById(row_id);
                remove_row.style.display = 'None'; 
            } else {
                alert("Error unfavoriting user.");
            }
        }).catch(error => {
            console.log(error);
        });
}

function removeBlocked(row, created_by) {
    row_creator = row.getAttribute('created-by');
    if (row_creator == created_by) {
        row.remove();
    };
}

var block_user = flask_util.url_for('home.block_user');

function blkUser(created_by) {
    const formData = new FormData();
    formData.append('block_user_id', created_by);

    // loop tru the table bodys rows and remove the row with the matching user id
    let table_body = document.getElementById("que-more-search-results-body");
    let rows = table_body.getElementsByTagName("tr");
    let i = 0;
    while (i < rows.length) {
        for (var r of rows) {
            row_creator = r.getAttribute('created-by');
            if (row_creator == created_by) {
                r.remove();
                i--;
            };
        };
        i++;
    };

    fetch(block_user, {
        method: 'POST',
        body: formData,
        enctype: 'multipart/form-data'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data == 'ok') {
                // remove the row from the table
                let row = ev.target.parentElement.parentElement;
                row.parentElement.removeChild(row);
            } else {
                alert("Error unfavoriting user.");
            }
        }).catch(error => {
            console.log(error);
        });
}

function clearTable() {
    let table_body = document.getElementById("que-more-search-results-body");
    while (table_body.firstChild) {
        table_body.removeChild(table_body.firstChild);
    }
}

// home page --- this is all the work of AI. check it over!!
var unblock_user = flask_util.url_for('home.unblock_user');

function unBlockUser(ev) {
    ev.preventDefault();
    const blk_user_id = ev.target.getAttribute('data-unblk-usr');
    // const block_usr_id = JSON.stringify(blk_user_id);

    const formData = new FormData();
    formData.append('blk_user_id', blk_user_id);

    fetch(unblock_user, {
        method: 'POST',
        body: formData,
        enctype: 'multipart/form-data'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data == 'ok') {
                // remove the row from the table
                let row = ev.target.parentElement;
                row.parentElement.removeChild(row);
            } else {
                alert("Error unfavoriting user.");
            }
        }).catch(error => {
            console.log(error);
        });

}




var SAVE_2_QUE = flask_util.url_for('home.save_to_que');

function saveToQue(ev) {
    ev.preventDefault();

    // FIRST DO VALIDATION TO SEE THAT THERE ARE CHECKBOXES SELECTED/QUESTIONS QUED!!!

    const que_table_body = document.getElementById("que-more-search-results-body");
    const rows = [...que_table_body.children];

    let que = [];
    rows.forEach(row => {
        // Get the checkbox element
        let checkbox = row.querySelector('input[type="checkbox"]');
        // Get the value of the checkbox
        let isChecked = checkbox.checked;
        if (isChecked) {
            let question_id = row.getAttribute('question-id');
            que.push(question_id);
        }

    });


    const que_arry = JSON.stringify({ que: que });


    fetch(SAVE_2_QUE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: que_arry
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data == 'ok') {
                (function () {
                    location.reload();
                })
            } else {
                alert("Error Queing Questions");
            }
        }).catch(error => {
            console.log(error);
        });

}

var FAV_USER_URL = flask_util.url_for('home.fav_user');

function addFavoriteUser(ev) {
    ev.preventDefault();
    const fav_user_id = ev.target.getAttribute('data-value');

    fetch(FAV_USER_URL, {
        method: 'POST',
        body: fav_user_id,
        enctype: 'text/plain'
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Http error! status: ${response.status}`);
        }
        return response.json();
    }).then(data => {
        if (data == 'ok') {
            // hide the favorite user button
            const fav_user_button = document.querySelector('#favorite-user-button');
            fav_user_button.style.display = 'none';
        } else {
            throw new Error(`Server returned response other than ok for favoriting a user. status: ${data}`)
        };

    }
    ).catch(
        error => {
            console.log(error);
        }
    );

}




