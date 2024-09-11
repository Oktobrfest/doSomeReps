var RATEQ = flask_util.url_for('quest_ajx.rateq');
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

    // Clear Flash messages
    function dismissAlert(alert) {
        alert.classList.remove('show');
        alert.classList.add('hide');
        setTimeout(() => alert.remove(), 250);
    }   
    // Timeout Flash alert messages
    function timeoutAlerts() {
         document.querySelectorAll('.alert').forEach(alert => {
            setTimeout(() => dismissAlert(alert), 8000);
        });
    }

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

        // Check for post-reload messages
        let msg = sessionStorage.getItem('postReloadMsg');
        if (msg) {
            setMsg(msg);
            sessionStorage.removeItem('postReloadMsg');
        }
    }

    // exclude other pages from loading this
    if (window.location.pathname === '/editquestions') {
        // select the search form
        const filterform = document.getElementById('search-filters-form');
        // select the search button
        const searchbutton = document.getElementById('search-button');
        searchbutton.addEventListener('click', clearMsgArea);
        // process the search
        searchbutton.onclick = function () { getSearchData(filterform) };

        const save_question_button = document.querySelector("#save-question-button");
        save_question_button.addEventListener('click', clearMsgArea);

        // add select all cats button
        const insert_into_div = document.getElementById("search-filters");
        let select_all_btn = document.createElement("button");
        select_all_btn.setAttribute('class', 'select-all-btn-edit-qs btb btn-secondary');
        select_all_btn.id = 'select-all-btn-edit-qs';
        select_all_btn.textContent = 'Select All';

        insert_into_div.append(select_all_btn);

        function handleSelectAllClick() {
            event.preventDefault();
            let checkboxes = document.querySelectorAll('#search-filters-form input[type="checkbox"]#category_name');
            let allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

            for (let checkbox of checkboxes) {
                checkbox.checked = !allChecked;
            }
            this.textContent = allChecked ? 'Select All' : 'Uncheck All';
        }

        select_all_btn.addEventListener('click', handleSelectAllClick);
    }
    // expanding textarea fields
    if ((window.location.pathname === '/addcontent') || (window.location.pathname === '/editquestions')) {
        const textareas = document.getElementsByTagName('textarea');
        for (let i = 0; i < textareas.length; i++) {
            autoResize(textareas[i]);
            textareas[i].addEventListener('input', function () {
                autoResize(this);
            });
        }
        if (window.location.pathname === '/addcontent') {
            // make sure checkboxes are selected before submitting
            let form = document.getElementById('add_question');
            document.getElementById("select-all-btn").classList.add("hidden");

            // Add a 'submit' event listener to the form
            form.addEventListener('submit', function (event) {
                // Select all checkboxes
                let checkboxes = document.getElementsByClassName('custom-checkbox');

                // Check if at least one checkbox is checked
                let atLeastOneChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);

                // If no checkboxes are checked, prevent the form from being submitted and display an alert
                if (!atLeastOneChecked) {
                    event.preventDefault();
                    alert('Please select at least one category before submitting the form.');
                }
            });

            timeoutAlerts();
        }
    }

    if (window.location.pathname === '/quiz') {
        const add_favorite_button = document.querySelector("#favorite-user-button");
        if (add_favorite_button) {
            add_favorite_button.addEventListener('click', addFavoriteUser);
        };

        const submit_answer_button = document.getElementById('answer-submit-btn');
        if (submit_answer_button) {
            submit_answer_button.addEventListener('click', submitAnswer, {
                once: true
            }
            );
        };
        // const exclude_q_btn = document.getElementById('exclude-question-button');
        // exclude_q_btn.addEventListener('click', exclude_q);

        const blk_button = document.getElementById('block-user-button');
        if (blk_button) {
            let creator = blk_button.getAttribute('data-value');
            blk_button.addEventListener('click', function (event) {
                event.preventDefault();
                blkUser(creator)
            });
        };


        // rating questions
        let radios = document.getElementsByName('stars');

        if (radios) {
            for (let i = 0; i < radios.length; i++) {
                radios[i].addEventListener('change', function () {
                    if (this.checked) {
                        // This radio button is checked, send its value to server
                        let rating = this.value;
                        submit_rating(rating);
                    }
                });
            };
        };
    }

    if (window.location.pathname === '/about') {
        let timesCollection = document.getElementsByClassName('rep-duration');

        Array.prototype.forEach.call(timesCollection, function (element) {
            let days = parseFloat(element.outerText);
            if (days < .04) {
                // convert to hours
                let hours = (days * 24.0 * 60).toFixed();
                element.textContent = hours + ' Mins';
            } else if
                (days > .04 && days < 2) {
                let hours = (days * 24.0).toFixed();
                element.textContent = hours + ' Hours';

            } else {
                element.textContent = days.toFixed() + ' days';
            };
        });
    }

    if ((window.location.pathname === '/quiz') || (window.location.pathname === '/quemore') || (window.location.pathname === '/editquestions')) {
        document.getElementById("select-all-btn").addEventListener("click", function () {
            event.preventDefault();
            let checkboxes = document.querySelectorAll('input[type="checkbox"]#category_name');
            let allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

            for (let checkbox of checkboxes) {
                checkbox.checked = !allChecked;
            }
            this.textContent = allChecked ? 'Select All' : 'Uncheck All';
        });
    }

    if (window.location.pathname === '/topiclist') {
        const table = document.getElementById('topic-table');

        // Get the table headers
        const topicHeader = document.getElementById('sort-by-topic');
        const countHeader = document.getElementById('sort-by-count');

        // Convert table rows to an array
        const rows = Array.from(table.rows).slice(1); // Exclude the header row

        // Event listener for the 'Topic List' header
        topicHeader.addEventListener('click', () => {
            toggleSortIndicator(topicHeader);
            // Sort the rows alphabetically by topic
            rows.sort((a, b) => a.cells[0].innerText.localeCompare(b.cells[0].innerText));
            // Clear the table and add the sorted rows
            while (table.rows.length > 1) table.deleteRow(1);
            rows.forEach(row => table.appendChild(row));
        });

        // Event listener for the 'Question Count' header
        countHeader.addEventListener('click', () => {
            toggleSortIndicator(countHeader);
            // Sort the rows numerically by count
            rows.sort((a, b) => a.cells[1].innerText - b.cells[1].innerText);
            // Clear the table and add the sorted rows
            while (table.rows.length > 1) table.deleteRow(1);
            rows.forEach(row => table.appendChild(row));
        });

          // Function to toggle the sort indicator class on the header
const toggleSortIndicator = (header) => {
    const isSorted = header.classList.contains('sorted');
    topicHeader.classList.remove('sorted');
    countHeader.classList.remove('sorted');
    if (!isSorted) {
      header.classList.add('sorted');
    }
  };
  }
}

function submit_rating(rating) {
    const quizq = document.getElementById('quizq-id');
    const quizq_id = quizq.value;

    const rating_data = JSON.stringify({ 'quizq_id': quizq_id, 'rating': rating });

    fetch(RATEQ, {
        method: 'POST',
        body: rating_data,
        headers: {
            'Content-Type': 'application/json'
        },
    }

    ).catch(error => {
        console.error('Error: ', error);
    })
}

function highlight(x) {
    x.style.borderStyle = "dotted solid double dashed";
    // new window.FlashMessage('This is a successs flash message !', 'success');
}

function unhighlight(x) {
    x.style.borderStyle;
}
// add a new category
var ADD_CAT = flask_util.url_for('quest_ajx.addcat');

function addSubmit(ev) {
    ev.preventDefault();
    fetch(ADD_CAT, {
        method: 'POST',
        body: new FormData(this)
    })
        .then(response => response.json())
        .then(res => {
            if (res.data !== 'error') {
                addCatHtml(res.data, res.htl)
            };
        })
        .catch(error => console.error('Error:', error));
}

function addCatHtml(data, htl) {
    // var span = document.getElementById('resTextlt');
    let node = document.createElement("li");
    node.className = 'list-group-item category-item border';
    let checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = 'category_name';
    checkbox.checked = true;
    checkbox.value = htl;
    checkbox.id = 'category_name'
    checkbox.setAttribute('class', 'custom-checkbox');

    const label = document.createElement('label');
    label.htmlFor = 'category_name';
    label.setAttribute('class', 'checkbox-inline');
    // didnt work label_txt = '  ' + data
    const str1 = '.  ';
    const label_txt = str1.concat('    ', data);
    label.appendChild(document.createTextNode(label_txt));
    n = document.getElementById("categories").appendChild(node);
    n.appendChild(checkbox);
    n.appendChild(label);
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
    const selected_boxes = [];
    // Iterate over the checkboxes and add the checked ones to the object
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selected_boxes.push(checkbox.value);
        }
    });
    // Convert the JavaScript object to a JSON string
    const selected_catz = JSON.stringify(selected_boxes);

    fetch(quiz_page, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: selected_catz
    })
    .catch(error => {
        console.log(error);
    });
}

var searchq = flask_util.url_for('quest_ajx.searchq');

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

    const selected_search_within = [];
    search_within_checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selected_search_within.push(checkbox.value);
        }
    });

    // get excluded checkbox
    var excluded_filter = document.getElementById('excluded-filter-checkbox').checked;

    // get search query
    const search_val = document.getElementById('search-terms').value;

    // aggregate the forms values
    const search_values = {
        'search-terms': search_val,
        'search-categories': selected_search_categories,
        'search-within': selected_search_within,
        'excluded-filter-checkbox': excluded_filter
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
                let text = document.createTextNode(item.question_text);
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
                hidden.type = "hidden";
                hidden.name = item.question_id;
                hidden.value = item.question_id;
                hidden.id = item.question_id;;
                hidden.setAttribute('data-value', item.question_id);
                li.setAttribute('data-value', item.question_id);
                li.appendChild(hidden);

                if (excluded_filter == true) {
                    let unexc = document.createElement('Button');
                    unexc.name = 'unexclude-q-' + item.question_id;
                    unexc.innerHTML = 'Unexclude Question';
                    unexc.id = 'unexclude-question-button';
                    unexc.className = 'unexclude-button btn btn-secondary';
                    unexc.setAttribute('data-value', item.question_id);
                    li.appendChild(unexc);
                    // unexclude button eventlistiner
                    unexc.addEventListener('click', function (event) {
                        event.preventDefault();
                        unexclude(event);
                    });
                };

                li.addEventListener('click', clearMsgArea);
                li.addEventListener('click', populateQuestion);
                let result_list_div = document.getElementById("search-results-list-unstyled").appendChild(li);
            });
        })
        .catch(error => {
            console.log(error);
        });
};


var UNEXCLUDE_Q = flask_util.url_for('que_ajx.unexclude_q');

function unexclude(event) {

    var question_id = event.target.dataset.value;

    fetch(UNEXCLUDE_Q, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: question_id
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Data received: ${response}`);
            };
            return response.json();
        })
        .then(() => {
            const listItem = document.querySelector(`li[data-value="${question_id}"]`);
            listItem.style.display = 'None';
        })
        .catch(error => {
            console.log(error);
        });
}


var getq = flask_util.url_for('quest_ajx.getq');

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
            document.getElementById("question_text").value = data.question_text;
            document.getElementById("hint").value = data.hint;
            document.getElementById("answer").value = data.answer;
            document.getElementById("question-id").value = data.id;
            document.getElementById("privacy-checkbox").checked = data.privacy;
            // get list of categories
            // console.log(data['categories']);
            // loop through the categories and check the checkboxes
            data['categories'].forEach(function (item) {
                let cat = addUnderscores(item);
                const checkbox = document.querySelector('#editquestionform-area input[type="checkbox"][value="' + cat + '"]');
                checkbox.checked = true;
            });

            const submitBtn = document.getElementsByClassName('question-submit-button')[0];
            const autoQue = document.getElementById('auto-que-checkbox-section');

            // Set its display property to none
            submitBtn.style.display = 'none';
            autoQue.style.display = 'none';

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
                    // img.baseURI = "https://reppics.s3.us-west-2.amazonaws.com"
                    let imgContainer = createImgContainer(pic_id);
                    imgContainer.appendChild(img);

                    // formulate element ID to put img in the right spot
                    let imgLocationID = "upload-" + picType + "-image";
                    let question_image = document.getElementById(imgLocationID);
                    question_image.appendChild(imgContainer);
                }
            }
            // Call autoResize function to resize these textarea after setting their values
            autoResize(question_text);
            autoResize(hint);
            autoResize(answer);
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
    button.name = 'pic-' + pic_id + '-close-button';
    button.type = "button";
    button.value = 'X';
    button.id = button.name;
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

var saveq = flask_util.url_for('quest_ajx.saveq');

function saveQuestion(ev) {
    let q = {};
    q.question_text = document.getElementById("question_text").value;
    q.hint = document.getElementById("hint").value;
    q.answer = document.getElementById("answer").value;
    q.id = document.getElementById("question-id").value;
    let checkBox = document.getElementById("privacy-checkbox");
    if (checkBox.checked) {
        q.privacy = true;
    } else {
        q.privacy = false;
    }

    // validation
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

var deleteq = flask_util.url_for('quest_ajx.deleteq');

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
    // make sure there's something to clear first
    let question_txt = document.getElementById("question_text");
    let hint = document.getElementById("hint");
    let answer = document.getElementById("answer");
    let question_id = document.getElementById("question-id");
    let privacy_checkbox = document.getElementById("privacy-checkbox");
    let edit_question_title_heading = document.getElementById("edit-question-title-heading");

    if (question_txt == null || hint == null || answer == null || question_id == null || privacy_checkbox == null || edit_question_title_heading == null) {
        return;
    }

    // clear out the previous forms pictures
    clearPics();

    // clear out the categories checkboxes
    const checkboxes = document.querySelectorAll('#editquestionform-area input[type="checkbox"]');
    checkboxes.forEach(function (checkbox) {
        checkbox.checked = false;
    });

    // clear out the form values
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

function setMsg(msg, msg_category = 'success', fadeout_secs = null) {
    let msgArea = document.getElementById("my-message-area");
    let msgDiv = document.createElement('div');
    msgDiv.setAttribute('class', `alert alert-${msg_category === 'error' ? 'danger' : msg_category} alert-dismissible fade show`);
    msgDiv.innerHTML = msg;  
   
    let msgButton = document.createElement('button');
    msgButton.className = 'close';
    msgButton.setAttribute('data-dismiss', 'alert');
    msgButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    msgDiv.appendChild(msgButton);

    msgArea.appendChild(msgDiv);
    msgArea.style.display = "block";

    if (fadeout_secs) {
        setTimeout(() => {            
            fadeOutEffect(msgDiv);
         }, fadeout_secs * 1000);
    }
}

function fadeOutEffect(fadeTarget) {
    var fadeEffect = setInterval(function () {
        if (!fadeTarget.style.opacity) {
            fadeTarget.style.opacity = 1;
        }
        if (fadeTarget.style.opacity > 0) {
            fadeTarget.style.opacity -= 0.1;
        } else {
            fadeTarget.remove(); 
            clearInterval(fadeEffect);
        }
    }, 200);
}

function hideQuestionArea() {
    // hide question area
    const question_area = document.getElementById("editquestionform-area");
    question_area.style.display = "none";
}

var searchquefilters = flask_util.url_for('que_ajx.searchquefilters');

function queMoreSearch(ev) {
    ev.preventDefault();
    // get filter values
    const filters_obj = {
        personal: document.getElementById("personal").checked,
        public: document.getElementById("public").checked,
        favorate: document.getElementById("favorate").checked,
        blocked: document.getElementById("blocked").checked,
        excluded: document.getElementById("excluded").checked,
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
            clearMsgArea();
            if ( data.msg ) {
                setMsg(data.msg, data.msg_category, 5);
            }
            if (data.status != 'ok') {
                return;
            } else {      
                // qty to add counter
                const qty_field = document.getElementById("qty_to_que");
                let que_count = qty_field.value;

                // populate the que search results list
                let table_body = document.getElementById("que-more-search-results-body");
                data.data.forEach(q => {
                    let row = document.createElement("tr");
                    row.className = "que-more-search-results-row";
                    row.setAttribute('question-id', q.question_id);
                    row.setAttribute('created-by', q.created_by);
                    table_body.appendChild(row);

                    // make cells & que checkbox
                    let que_cell = document.createElement("td");
                    let que_checkbox = document.createElement('input');
                    que_checkbox.type = "checkbox";
                    que_checkbox.name  = 'que-question-' + q.question_id + '-chkbox';
                    que_checkbox.className = "que-question-chkbox question-chkbox";
                    que_checkbox.id = que_checkbox.name;
                    que_cell.appendChild(que_checkbox);
                    row.appendChild(que_cell);

                    // select box counter
                    if (q.excluded == false & que_count > 0) {
                        que_cell.childNodes[0].checked = true;
                        //console.log("que_count: " + que_count);
                        que_count -= 1;
                    }

                    // exclude checkbox
                    let exclude_cell = document.createElement("td");
                    let ex_checkbox = document.createElement('input');
                    ex_checkbox.type = "checkbox";
                    ex_checkbox.name = 'exclude-question-' + q.question_id + '-chkbox';
                    ex_checkbox.className = "exclude-question-chkbox question-chkbox";
                    ex_checkbox.id = ex_checkbox.name;
                    exclude_cell.appendChild(ex_checkbox);
                    row.appendChild(exclude_cell);

                    // check-box if excluded
                    if (q.excluded == true) {
                        exclude_cell.childNodes[0].checked = true;
                    }

                    let hidden_exc = document.createElement('input');
                    hidden_exc.type = 'hidden';
                    hidden_exc.name = 'excluded-q-' + q.question_id;
                    hidden_exc.value = hidden_exc.name;
                    row.setAttribute('data-excluded-q', q.excluded);
                    row.appendChild(hidden_exc);

                    // only one checked at a time
                    que_checkbox.addEventListener('change', () => {
                        if (que_checkbox.checked) {
                            ex_checkbox.checked = false;
                        }
                    });

                    ex_checkbox.addEventListener('change', () => {
                        if (ex_checkbox.checked) {
                            que_checkbox.checked = false;
                        }
                    });

                    // Username
                    let username_cell = document.createElement("td");

                    username_cell.innerHTML = q.username;
                    let blk_button = document.createElement("button");

                    blk_button.className = "btn btn-danger block-button";
                    blk_button.setAttribute('data-blk-user-id', q.created_by);

                    blk_button.addEventListener('click', function (event) {
                        event.preventDefault();
                        let blocked_user = clearBlockedUsers(q.created_by);
                        blocked_user.blkUser();
                    });

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

var unfavorite_user = flask_util.url_for('user_ajx.unfavorite_user');

function unFavoriteUser(ev) {
    ev.preventDefault();
    const user_id = ev.target.getAttribute('data-unfav-usr');

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
    let row_creator = row.getAttribute('created-by');
    if (row_creator == created_by) {
        row.remove();
    };
}

var block_user = flask_util.url_for('user_ajx.block_user');

function clearBlockedUsers(created_by) {
    // loop tru the table bodys rows and remove the row with the matching user id
    let table_body = document.getElementById("que-more-search-results-body");
    let rows = table_body.getElementsByTagName("tr");
    let i = 0;
    while (i < rows.length) {
        for (var r of rows) {
            let row_creator = r.getAttribute('created-by');
            if (row_creator == created_by) {
                r.remove();
                i--;
            };
        };
        i++;
    };
    return created_by;
}

function blkUser(created_by) {
    const formData = new FormData();
    formData.append('block_user_id', created_by);

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

// home page -
var unblock_user = flask_util.url_for('user_ajx.unblock_user');

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

var SAVE_2_QUE = flask_util.url_for('que_ajx.save_to_que');

function saveToQue(ev) {
    ev.preventDefault();
    // FIRST DO VALIDATION TO SEE THAT THERE ARE CHECKBOXES SELECTED/QUESTIONS QUED!!!

    const que_table_body = document.getElementById("que-more-search-results-body");
    const rows = [...que_table_body.children];

    let que = [];
    let exclude = [];
    let unexclude = [];
    rows.forEach(row => {
        let question_id = row.getAttribute('question-id');
        // Get the checkbox element
        let q_checkbox = row.querySelector('input[type="checkbox"].que-question-chkbox');
        let ex_checkbox = row.querySelector('input[type="checkbox"].exclude-question-chkbox');
        // Get the value of the checkbox
        let q_isChecked = q_checkbox.checked;
        let ex_isChecked = ex_checkbox.checked;

        // see if exclsion property changed
        let currently_excluded = row.getAttribute('data-excluded-q');

        if (q_isChecked == true) {
            que.push(question_id);
        };

        if ((ex_isChecked == true) & (currently_excluded == "false")) {
            exclude.push(question_id);
        };
        if (ex_isChecked == false & currently_excluded == "true") {
            unexclude.push(question_id);
        };
    });

    const que_arry = JSON.stringify({ que: que, exclude: exclude, unexclude: unexclude });

    fetch(SAVE_2_QUE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: que_arry
    })
        .then(response => {
                  if (!response.ok) {
                console.log(response);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status == 'ok') {
                (function () {
                    sessionStorage.setItem('postReloadMsg', data.msg);
                    location.reload();
                    })();
            } else {
                alert("Error Queing Questions");
            }
        }).catch(error => {
            console.log(error);
        });

}

var FAV_USER_URL = flask_util.url_for('user_ajx.fav_user');

function addFavoriteUser(ev) {
    ev.preventDefault();
    const fav_user_id = ev.target.getAttribute('data-value');

    fetch(FAV_USER_URL, {
        method: 'POST',
        body: fav_user_id,
        enctype: 'text/plain'
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Http error! status: ${response.status}, data returned: ${data}`);
        }
        return response.json();
    }).then(data => {
        if (data == 'ok') {
            // hide the favorite user button
            const fav_user_button = document.querySelector('#favorite-user-button');
            fav_user_button.style.display = 'none';
        } else {
            throw new Error(`status: ${response.status}. Server returned response other than ok for favoriting a user. status: ${data}`)
        };
    }
    ).catch(
        error => {
            console.log(error);
        }
    );
}

function submitAnswer() {
    const provided_answer_text = document.getElementById('provided-answer-field');
    provided_answer_text.classList.add("disabled");
    provided_answer_text.readOnly = true;

    const submit_answer_button = document.getElementById('answer-submit-btn');
    submit_answer_button.style.display = 'none';

    setTimeout(function () {
        scrollToBottom();
    }, 200);
}

//scroll to bottom of quiz page
function scrollToBottom() {
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    document.body.scrollTop = document.body.scrollHeight;
    // window.scrollTo( 0, document.body.scrollHeight);
}

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}

function addUnderscores(str) {
    return str.replace(/ /g, "_");
}






