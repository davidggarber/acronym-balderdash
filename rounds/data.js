const rounds = [];

const acronyms = {};

function addRound(script, round) {
    if (!(typeof round.acronym === "string")) {
        console.error(`${script.src} : Malformed acronym`);
        return;
    }
    else if (round.acronym.trim().length == 0) {
        console.warn(`${script.src} : Acronym is empty`);
        return;
    }
    else if (!(Array.isArray(round.guesses))) {
        console.error(`${round.acronym} : Malformed guesses`);
        return;
    }
    else if (round.acronym in acronyms) {
        console.error(`${round.acronym} : Duplicate acronym in ${script.src} and ${acronyms[round.acronym]}`);
        return;
    }
    // Below here, we at least have a valid acronym, so we don't need to early-return

    else if (!round.guesses.every(guess => typeof guess.definition === "string")) {
        console.error(`${round.acronym} : Malformed guess definition`);
    }
    else if (round.guesses.length < 3) {
        console.warn(`${round.acronym} : Not enough guesses`);
    }
    else if (!round.guesses.every(guess => guess.definition.trim().length > 0)) {
        console.warn(`${round.acronym} : Empty guess definition`);
    }
    else if (!round.guesses.some(guess => guess.correct)) {
        console.warn(`${round.acronym} : No correct guess`);
    }
    else {
        rounds.push(round);
        console.log(`${round.acronym} : Playable as round ${rounds.length}`);
    }

    acronyms[round.acronym] = script.src;
}
