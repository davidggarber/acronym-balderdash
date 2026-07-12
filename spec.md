# Acronym Balderdash

## Files

Web page: abc.html
Game data: game-data.js
Game logic: game.js

## User experience

This is a single page, with a title (and acronym), and 4-6 guesses for what the acronym stands for.
The title is always shown, and is clearly highlighted.
The guesses are revealed one at a time. Enlarged at first. With a number next to them (1-6, in order).
After being read, the guess shrinks to normal size, and joins the others in the background, so the next guess can be read.

Once all are read, there is a pause, while players reading the page each pick their favorite.

There are several ways in which the correct answer may be revealed, with UI triggers for each one.

There are also menu commands to go to other game rounds (forward 1, back 1, or jump)


## Backing data

One game round is a javascript object, with:
- a title (the acronym)
- a list of guesses
- a number of times this round has been played

Each guess has
- a definition,
- an author, which may be a team number
- a count of times it received votes
- optional flags
    
The flags include:
- Correct (the actual correct answer)
- CoinFlip (a favorite wrong answer, to keep if all other wrongs are discarded)
- MontyHall (a second wrong answer, to keep if we're keeping only 3)
- Ignore (don't use this guess, but its index is unavailable)

The page as a whole will have a list of game rounds, to be played in order.

## Saving and reloading data

Game rounds are authored in a separate .js file, loaded by the page.
The rounds may be edited separately. The page may be refreshed in order to load the newest versions.

As the game is played, it writes its progress to local state, and when it refreshes, it reloads that state.
Local state includes:
- The current round number
- The number of votes that every guess received (tracked by round number and guess number)

## Scoring UI

There is an alternate view, which shows a table of all rounds that have been played at least once.
Table rows are the rounds. The row title is the acronym, and then in parentheses, the number of times the round has been played.
Table columns are the guess indeces.
The data in each cell is the number of votes that guess received.
The table cells are color-coded.
- green for correct
- grey for no incorrect and 0 votes
- increasingly vivid red for more and more votes

## Display UI

The game respects the browser's light- or dark-mode setting.

*The following description assumes dark mode, so invert white/black for light mode.*

- The round number should appear in medium-large text, in the upper-left
- The Acronym should be in especially large text, centered at the top, with a marquee look
- Each guess is in a colored box, with an index in its upper-left, and its description written out centered horizontally and vertically.
- The colors are set according to guess index. 1:red, 2:orange, 3:yellow, 4:green, 5:blue, 6:violet
- When each guess is first displayed, it is centered on the page, and scaled to 2x size.
- It then uses keyframe animation to shrink to normal size, and go to its position on the page.
- Final positions are in two columns, under the acronym marquee
- There is a menu to change rounds in the upper-right

There is a menu for playing the round:
- Next -> shows the next guess, if there is another. Grayed out once all are shown
- Prev -> backs up one step, re-animating the previous guess
- 50/50 -> confirmed with a yes/no "continue?" alert
- Monty Hall -> confirmed with a yes/no "continue?" alert
- Reveal

## Hint mode: 50/50

- Diosables all guesses other than those with falgs "Correct" or "CoinFlip".
- Hides both the 50/50 and Monty Hall options
- Hide contols for prev/next guess

## Hint mode: Monty Hall

The first click on the Monty Hall button triggers stage-1:
- Disables all guesses other than those with flags "Correct" or "CoinFlip" or "MontyHall".
- Hides the 50/50 option
- Changes the Monty Hall option to a 🐐 emoji, grayed out until the player votes, then enabled
- Hide contols for prev/next guess

## Hint mode: Hall

The second click on the Monty Hall button triggers stage-2:
- If the user has voted for an incorrect choice, disable the *other* incorrect choice
- If the user has voted for the correct choice, disable the choice flagged MontyHall
- In both of those cases, instaed of an X, disable with a goat
- Hide the Monty-hall button
- Allow the user to change their vote

## Voting

After all guesses are displayed, voting is active. Add a label, centered along the bottom, "Please vote!"
Clicking on any guess will add a vote. Vote count is shown by stars: 1 per vote.
Don't show the votes from previous iterations of the same round.

Shift-clicking will remove a vote (until down to 0)

## Reveal

The guess that is tagged "Correct" is animated to go back to the full-size state, from when it was first introduced.

## Next

If invoked before Reveal, show a yes/no confirmation alert first. If no, ignore.
If yes, clear all elements of the page, then increment the round number, then start over again.

## Prev

Clear all the elements of the page.
If invoked before the first guess was shown, then decrement the round number, and start that round from scratch.
Else if invoked anytime after the first guess was shown, restart the current round.