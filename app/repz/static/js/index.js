// Legacy page scripts. Everything left here belongs to a page that has not been
// converted to React yet: /quiz, /about and /topiclist.
//
// Already migrated (do not re-add): /, /quemore and /addcontent, plus the
// new-category form and the ad-hoc flash-message helpers those pages used.
var RATEQ = flask_util.url_for('quest_ajx.rateq');

window.onload = (event) => {

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

var block_user = flask_util.url_for('user_ajx.block_user');

function blkUser(created_by) {
    const formData = new FormData();
    formData.append('block_user_id', created_by);

    fetch(block_user, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data == 'ok') {
                // The quiz page shows one question, so there is no row to drop -
                // just retire the button that did the blocking.
                const blk_button = document.getElementById('block-user-button');
                if (blk_button) {
                    blk_button.style.display = 'none';
                }
            } else {
                alert("Error blocking user.");
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
