// Legacy page scripts. Everything left here belongs to /quiz, the last page
// that has not been converted to React yet.
//
// Already migrated (do not re-add): /, /quemore, /addcontent, /about,
// /topiclist, /topic/<topic> and /ai/profile, plus the new-category form and
// the ad-hoc flash-message helpers those pages used.
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
