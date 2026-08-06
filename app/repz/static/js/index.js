var RATEQ = flask_util.url_for('quest_ajx.rateq');
//  ACTUALLY RUNS JUST ONCE!!!
window.onload = (event) => {

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

        postReloadMsg();
    }

    // Check for post-reload messages
    function postReloadMsg() {
        let msg = sessionStorage.getItem('postReloadMsg');
        if (msg) {
            setMsg(msg);
            sessionStorage.removeItem('postReloadMsg');
        }
    }

    // expanding textarea fields
    if (window.location.pathname === '/addcontent') {
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

            // Add a 'submit' event listener to the form
            form.addEventListener('submit', function (event) {
                // Select all category checkboxes
                let checkboxes = document.querySelectorAll('input[name="category_name"]');

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

        document.querySelector('input[type="file"]').addEventListener('change', function(event) {
            const fileInput = event.target;
            const files = fileInput.files;
            const invalidFiles = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const filename = file.name;

                // Regex to check for filenames starting with a period or invalid characters
                const invalidCharRegex = /[^a-zA-Z0-9_. !@#$%^&()\-]/;
                const startsWithDot = filename.startsWith('.');
                const hasExtension = filename.includes('.');

                if (startsWithDot && !hasExtension) {
                    invalidFiles.push(filename);
                } else if (invalidCharRegex.test(filename)) {
                    invalidFiles.push(filename);
                }
            }

            if (invalidFiles.length > 0) {
                alert("The following filenames are invalid: " + invalidFiles.join(', '));
                fileInput.value = ''; // Clear the invalid files
            }
        });

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
        let originalValues = [];
        for (let i = 0; i < timesCollection.length; i++) {
            originalValues.push(parseFloat(timesCollection[i].outerText));
        }

        function formatDuration(days) {
            if (days < .04) {
                let mins = (days * 24.0 * 60).toFixed();
                return mins + ' Mins';
            } else if (days >= .04 && days < 2) {
                let hours = (days * 24.0).toFixed();
                return hours + ' Hours';
            } else if (days >= 365) {
                let years = (days / 365).toFixed(1);
                if (years.endsWith('.0')) {
                    years = parseFloat(years).toFixed();
                }
                return years + (years === '1' ? ' year' : ' years');
            } else if (days >= 30) {
                let months = (days / 30.4).toFixed(1);
                if (months.endsWith('.0')) {
                    months = parseFloat(months).toFixed();
                }
                return months + ' months';
            } else if (days >= 7) {
                let weeks = (days / 7).toFixed(1);
                if (weeks.endsWith('.0')) {
                    weeks = parseFloat(weeks).toFixed();
                }
                return weeks + ' weeks';
            } else {
                return days.toFixed() + ' days';
            }
        }

        for (let i = 0; i < timesCollection.length; i++) {
            let days = originalValues[i];
            let formattedCurrent = formatDuration(days);

            if (i > 0) {
                let diff = days - originalValues[i - 1];
                let formattedDiff = formatDuration(diff);
                timesCollection[i].textContent = formattedCurrent + ' (' + formattedDiff + ')';
            } else {
                timesCollection[i].textContent = formattedCurrent;
            }
        }
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

// add a new category
var ADD_CAT = flask_util.url_for('quest_ajx.addcat');

function addNewCategory(ev) {
    ev.preventDefault();

    // If this submission is already in progress, ignore the click
    if (this.dataset.submitting === 'true') {
        return;
    }

    // Mark as submitting
    this.dataset.submitting = 'true';

    const submitButton = this.querySelector('input[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
    }

    fetch(ADD_CAT, {
        method: 'POST',
        body: new FormData(this)
    })
        .then(response => response.json())
        .then(res => {
            if (res.data !== 'error') {
                // The category grid is React-owned; notify it to refetch.
                document.dispatchEvent(new CustomEvent('repz:categories-changed'));
            } else {
                console.error('Server error:', res.htl);
                alert('fail, try again.');
            }
        })
        .catch(error => console.error('Error:', error))
        .finally(() => {
            // Reset submission state
            this.dataset.submitting = 'false';
            if (submitButton) {
                submitButton.disabled = false;
                this.elements["0"].value = ""
            }
        });
}

// bind only once attempt#1
document.addEventListener('readystatechange', event => {
    // When window loaded ( external resources are loaded too- `css`,`src`, etc...)
    if (event.target.readyState === "complete") {
        runOnce(document);
    }
});

function runOnce(document) {
    var form = document.getElementById('new_cat');
    if (form) {
        // Initialize the submitting state
        form.dataset.submitting = 'false';
        form.addEventListener('submit', addNewCategory);
    }
};

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
    // React renders the grid with a hashed class; the name attribute is the
    // stable contract the backend already relies on.
    const selected_categories = document.querySelectorAll('input[name="category_name"]');

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

    document.dispatchEvent(new CustomEvent('askai:answer-revealed'));

    setTimeout(function () {
        scrollToBottom();
    }, 200);
}

//scroll to bottom of quiz page
function scrollToBottom() {
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    document.body.scrollTop = document.body.scrollHeight;
}

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}
