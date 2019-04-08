var elements = {
    messageBox: "messageBox",
    messageTitle: "messageTitle",
    messageBody: "messageBody",
    messageClose: "messageClose",
    messageFirstLink: "messageFirstLink",
    messageNextLink: "messageNextLink",
    messageError: "messageError",
    messageCycles: "messageCycles",
    messageBytes: "messageBytes",
    contentWelcome: "contentWelcome",
    contentSuccess: "contentSuccess",
    contentCompilationError: "contentCompilationError",
    contentSelect: "contentSelect",
    dimmer: "dimmer",
    puzzleList: "puzzleList",
    inputSource: "input",
    inputLoad: "load",
    inputStep: "step",
    inputStop: "stop",
    inputMenu: "menu",
    stateSource: "source",
    stateMemory: "memory",
    stateRunning: "running",
    stateCycles: "cycles",
    stateBytes: "bytes",
    title: "title",
    description: "description",
    io: "io",
    ioBody: "ioBody"
}

for (var name in elements) {
    if (name !== undefined) {
        elements[name] = document.getElementById(elements[name]);
    }
}

function clearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function hideChildren(element) {
    for (var i = 0; i < element.childNodes.length; i++) {
        var classList = element.childNodes[i].classList;
        if (classList) {
            classList.add("hidden");
        }
    }
}

function hexifyByte(v) {
    var str = v.toString(16);
    if (str.length == 1) {
        str = "0" + str;
    }
    return str;
}

// Peristent state
function createDefaultPersistentState() {
    return{
        introShown: false,
        solvedCount: 0,
        currentPuzzle: undefined
    };
}

function createDefaultPuzzlePersistentState() {
    return {
        unlocked: false,
        viewed: false,
        solved: false,
        solutionCycles: undefined,
        solutionBytes: undefined,
    
        code: null
    };
}

var persistentStateCache = {};
function loadPersistentObjectWithDefault(key, defaultObjectCreator) {
    var persistentState = persistentStateCache[key];
    if (!persistentState) {
        try {
            var str = localStorage.getItem(key);
            if (str) {
                persistentState = JSON.parse(str);
            }
        } catch (e) {}
    
        persistentState = persistentState || defaultObjectCreator();
        persistentStateCache[key] = persistentState;
    }

    return persistentState;
}

function savePersistentObject(key) {
    try {
        localStorage.setItem(key, JSON.stringify(persistentStateCache[key]));
    } catch (e) {} // Work around Edge bug...
}

var persistentStateKey = "sic1_";
function loadPersistentState() {
    return loadPersistentObjectWithDefault(persistentStateKey, createDefaultPersistentState);
}

function savePersistentState() {
    savePersistentObject(persistentStateKey);
}

function getPuzzlePersistentStateKey(title) {
    return "sic1_Puzzle_" + title;
}

function loadPuzzlePersistentState(title) {
    return loadPersistentObjectWithDefault(getPuzzlePersistentStateKey(title), createDefaultPuzzlePersistentState);
}

function savePuzzlePersistentState(title) {
    savePersistentObject(getPuzzlePersistentStateKey(title));
}

// Message box
var messageBoxOpen = false;
var modalMessageBoxOpen = false;
function showMessage(title, element, modal) {
    clearChildren(elements.messageTitle);
    elements.messageTitle.appendChild(document.createTextNode(title));
    hideChildren(elements.messageBody);
    element.classList.remove("hidden");
    elements.messageBox.classList.remove("hidden");
    elements.dimmer.classList.remove("hidden");

    messageBoxOpen = true;
    modalMessageBoxOpen = modal;
    if (modalMessageBoxOpen) {
        elements.messageClose.classList.add("hidden");
    } else {
        elements.messageClose.classList.remove("hidden");
    }
}

function closeMessageBox() {
    elements.messageBox.classList.add("hidden");
    elements.dimmer.classList.add("hidden");
    messageBoxOpen = false;
    modalMessageBoxOpen = false;
}

elements.messageClose.onclick = function () {
    if (!modalMessageBoxOpen) {
        closeMessageBox();
    }
};

elements.messageFirstLink.onclick = function (e) {
    e.preventDefault();
    loadPuzzle(puzzles[0]);
    closeMessageBox();
};

elements.messageNextLink.onclick = function (e) {
    e.preventDefault();
    showPuzzleList();
};

elements.dimmer.onclick = function () {
    if (!modalMessageBoxOpen) {
        closeMessageBox();
    }
};

// Highlighting helper
function ElementList() {
    this.groups = {};
    this.highlightedElements = [];
}

ElementList.prototype.add = function (groupName, index, element) {
    var group = this.groups[groupName];
    if (!group) {
        group = [];
        this.groups[groupName] = group;
    }

    group[index] = element;
};

ElementList.prototype.highlight = function (groupName, index, className, durable) {
    var element = this.groups[groupName][index];
    element.classList.add(className);
    
    this.highlightedElements.push({
        groupName: groupName,
        index: index,
        durable: durable,
        className: className
    });
};

ElementList.prototype.clear = function (includeDurable) {
    var newList = [];
    for (var i = 0; i < this.highlightedElements.length; i++) {
        var item = this.highlightedElements[i];
        if (includeDurable || !item.durable) {
            this.groups[item.groupName][item.index].classList.remove(item.className);
        } else {
            newList.push(item);
        }
    }

    this.highlightedElements = newList;
};

ElementList.prototype.deleteGroup = function (groupName) {
    var group = this.groups[groupName];
    if (group) {
        group.length = 0;
    }
};

var highlighter = new ElementList();

// Memory display
var memoryMap = [];
var columnSize = 16;
for (var i = 0; i < 256; i += columnSize) {
    var tr = document.createElement("tr");
    for (var j = 0; j < columnSize; j++) {
        var td = document.createElement("td");
        var textNode = document.createTextNode("00");
        td.appendChild(textNode);
        memoryMap[i + j] = {
            td: td,
            textNode: textNode
        };

        highlighter.add("memory", i + j, td);

        tr.appendChild(td);
    }

    elements.stateMemory.appendChild(tr);
}

// Puzzle
var puzzles = [
    {
        title: "Tutorial 1",
        minimumSolvedToUnlock: 0,
        description: "Use subleq and input/output to negate an input and write it out",
        code:
  "; The SIC-1 is an 8-bit computer with 256 bytes of memory.\n"
+ "; Programs are written in SIC-1 Assembly Language.\n"
+ "; Each instruction is 3 bytes, specified as follows:\n"
+ "; \n"
+ ";   subleq <A> <B> [<C>]\n"
+ "; \n"
+ "; A, B, and C are memory addresses (0 - 255) or labels.\n"
+ "; \n"
+ "; \"subleq\" subtracts the value at address B from the\n"
+ "; value at address A and stores the result at address A\n"
+ "; (i.e. mem[A] = mem[A] - mem[B]).\n"
+ "; \n"
+ "; If the result is <= 0, execution branches to address C.\n"
+ "; \n"
+ "; Note that if C is not specified, the address of the next\n"
+ "; instruction is used (in other words, the branch does\n"
+ "; nothing).\n"
+ "; \n"
+ "; For convenience, addresses can be specified using labels.\n"
+ "; The following predefined lables are always available:\n"
+ "; \n"
+ ";   @IN (253): Reads a value from input (writes are ignored)\n"
+ ";   @OUT (254): Writes a result to output (reads as zero)\n"
+ ";   @HALT (255): Terminates the program when executed\n"
+ "; \n"
+ "; Below is a very simple SIC-1 program that negates one input\n"
+ "; value and writes it out.\n"
+ "; \n"
+ "; E.g. if the input value from @IN is 3, it subtracts 3 from\n"
+ "; @OUT (which reads as zero), and the result of 0 - 3 = -3 is\n"
+ "; written out.\n"
+ "\n"
+ "subleq @OUT, @IN\n"
+ "\n"
+ "; First, click \"Load\" to compile the program and load it\n"
+ "; into memory, then use the \"Step\" and \"Run\" buttons to\n"
+ "; execute the program until all expected outputs have been\n"
+ "; successfully written out (see the.\n"
+ "; \"In\"/\"Expected\"/\"Out\" table to the left).\n"
,
        io: [
            [3, -3],
        ]
    },
    {
        title: "Tutorial 2",
        minimumSolvedToUnlock: 1,
        description: "Use .data and labels to loop",
        code:
  "; Custom lables are defined by putting \"@name: \" at the\n"
+ "; beginning of a line, e.g.:\n"
+ "; \n"
+ ";   @loop: subleq 1, 2\n"
+ "; \n"
+ "; In addition to \"subleq\", there is an assembler\n"
+ "; directive \".data\" that sets a byte of memory to a value\n"
+ "; at compile time (note: this is not an instruction!):\n"
+ "; \n"
+ ";   .data <X>\n"
+ "; \n"
+ "; X is a signed byte (-128 to 127).\n"
+ "; \n"
+ "; Combining labels and the \".data\" directive allows you to:\n"
+ "; develop of system of variables:\n"
+ "; \n"
+ ";   @zero: .data 0\n"
+ "; \n"
+ "; This can be useful for implementing an unconditional jump:\n"
+ "; \n"
+ ";   subleq @zero, @zero, @loop\n"
+ "; \n"
+ "; This will set @zero to @zero - @zero (still zero) and,\n"
+ "; since the result is always <= 0, execution branches to\n"
+ "; @loop.\n"
+ "; \n"
+ "; Below is an updated negation program that repeatedly\n"
+ "; negates input values and writes them out.\n"
+ "\n"
+ "@loop:\n"
+ "subleq @OUT, @IN\n"
+ "subleq @zero, @zero, @loop\n"
+ "\n"
+ "@zero: .data 0\n"
,
        io: [
            [3, -3],
            [4, -4],
            [5, -5],
        ]
    },
    {
        title: "Tutorial 3",
        minimumSolvedToUnlock: 2,
        description: "Write input values to output",
        code:
  "; Now that you understand the \"subleq\" instruction, the\n"
+ "; \".data\" directive, and labels, you should be able to read\n"
+ "; values from input and write the exact same values out\n"
+ "; (hint: negate the value twice).\n"
+ "; \n"
+ "; For reference, here is the previous program that negates\n"
+ "; values on their way to output:\n"
+ "\n"
+ "@loop:\n"
+ "subleq @OUT, @IN\n"
+ "subleq @zero, @zero, @loop\n"
+ "\n"
+ "@zero: .data 0\n"
+ "\n"
,
        io: [
            [1, 1],
            [2, 2],
            [3, 3],
        ]
    }
];

function appendNumberOrArray(head, tail) {
    if (typeof(tail) === "number") {
        head.push(tail);
    } else {
        for (var i = 0; i < tail.length; i++) {
            head.push(tail[i]);
        }
    }
}

function createTd(text) {
    var td = document.createElement("td");
    td.appendChild(document.createTextNode((text !== undefined) ? text : ""));
    return td;
}

var currentPuzzle;
var inputBytes = [];
var expectedOutputBytes = [];
var ioInputMap = [];
var ioExpectedMap = [];
var ioActualMap = [];
function loadPuzzle(puzzle) {
    // Save previous puzzle progress, if applicable
    if (currentPuzzle && currentPuzzle.title) {
        savePuzzleProgress();
    }

    inputBytes.length = 0;
    expectedOutputBytes.length = 0;

    // TODO: Shuffle order
    for (var i = 0; i < puzzle.io.length; i++) {
        var row = puzzle.io[i];
        appendNumberOrArray(inputBytes, row[0]);
        appendNumberOrArray(expectedOutputBytes, row[1]);
    }

    var rowCount = Math.max(inputBytes.length, expectedOutputBytes.length);
    clearChildren(elements.ioBody);
    highlighter.deleteGroup("data1");
    highlighter.deleteGroup("data2");
    for (var i = 0; i < rowCount; i++) {
        var tr = document.createElement("tr");
        tr.appendChild(ioInputMap[i] = createTd((i < inputBytes.length) ? inputBytes[i] : undefined));
        tr.appendChild(ioExpectedMap[i] = createTd((i < expectedOutputBytes.length) ? expectedOutputBytes[i] : undefined));
        tr.appendChild(ioActualMap[i] = createTd());
        highlighter.add("data1", i, ioExpectedMap[i]);
        highlighter.add("data2", i, ioActualMap[i]);
        elements.ioBody.appendChild(tr);
    }

    elements.title.firstChild.nodeValue = puzzle.title;
    elements.description.firstChild.nodeValue = puzzle.description;

    // Load previous progress or fallback to default (or description)
    var puzzleState = loadPuzzlePersistentState(puzzle.title);
    var code = puzzleState.code;
    if (code === undefined || code === null) {
        if (puzzle.code) {
            code = puzzle.code;
        } else {
            code = "; " + puzzle.description;
        }
    }

    elements.inputSource.value = code;

    currentPuzzle = puzzle;
    var persistentState = loadPersistentState();
    if (persistentState.currentPuzzle !== puzzle.title) {
        persistentState.currentPuzzle = puzzle.title;
        savePersistentState();
    }

    setState(StateFlags.none);
    // TODO: Clear memory and cycle/byte counts

    // Mark as viewed
    if (!puzzleState.viewed) {
        puzzleState.viewed = true;
        savePuzzlePersistentState(puzzle.title);
    }
}

// State management
var StateFlags = {
    none: 0x0,
    running: 0x1,
    error: 0x2,
    done: 0x4
};

var state = StateFlags.none;
function setState(newState) {
    state = newState;
    var running = !!(state & StateFlags.running);

    var success = false;
    var label = "Stopped";
    if ((state & StateFlags.done) && !(state & StateFlags.error)) {
        success = true;
        label = "Completed"
    } else if (running) {
        label = "Running"
    }

    elements.stateRunning.innerText = label;

    // Swap editor and source view
    if (running) {
        elements.inputSource.classList.add("hidden");
        elements.stateSource.classList.remove("hidden");
    } else {
        elements.inputSource.classList.remove("hidden");
        elements.stateSource.classList.add("hidden");
    }

    // Remove highlights and output if not running
    if (!running) {
        highlighter.clear(true);
        for (var i = 0; i < ioActualMap.length; i++) {
            ioActualMap[i].firstChild.nodeValue = "";
        }
    }

    // Controls
    elements.inputLoad.disabled = running;
    elements.inputStop.disabled = !running;
    elements.inputStep.disabled = !running || success;
    // elements.inputRun.disabled = !running || success;

    if (success) {
        var solutionCycles = parseInt(elements.stateCycles.firstChild.nodeValue);
        var solutionBytes = parseInt(elements.stateBytes.firstChild.nodeValue);
        elements.messageCycles.firstChild.nodeValue = solutionCycles;
        elements.messageBytes.firstChild.nodeValue = solutionBytes;
        showMessage("Success", elements.contentSuccess, true);

        // Mark as solved
        var puzzleState = loadPuzzlePersistentState(currentPuzzle.title);
        if (!puzzleState.solved) {
            var persistentState = loadPersistentState();
            persistentState.solvedCount++;
            puzzleState.solved = true;
            puzzleState.solutionCycles = solutionCycles;
            puzzleState.solutionBytes = solutionBytes;

            savePersistentState();
            savePuzzlePersistentState(currentPuzzle.title);
        }
    }
}

function setStateFlag(flag, on) {
    if (on === false) {
        setState(state & ~flag);
    } else {
        setState(state | flag);
    }
}

// Puzzle list
function showPuzzleList() {
    clearChildren(elements.puzzleList);
    for (var i = 0; i < puzzles.length; i++) {
        (function (i) {
            // Read persistent state
            var puzzleState = loadPuzzlePersistentState(puzzles[i].title);

            // Check for unlock
            if (!puzzleState.unlocked) {
                var persistentState = loadPersistentState();
                if (persistentState.solvedCount >= puzzles[i].minimumSolvedToUnlock) {
                    puzzleState.unlocked = true;
                    savePuzzlePersistentState(puzzles[i].title);
                }
            }

            if (puzzleState.unlocked) {
                var a = document.createElement("a");
                a.href = "#";
                a.appendChild(document.createTextNode(puzzles[i].title));
                a.onclick = function (e) {
                    e.preventDefault();
                    loadPuzzle(puzzles[i]);
                    closeMessageBox();
                };
    
                var li = document.createElement("li");
                li.appendChild(a);

                // Show solution stats, if applicable
                if (puzzleState.solved && puzzleState.solutionCycles && puzzleState.solutionBytes) {
                    li.appendChild(document.createTextNode(" (SOLVED; cycles: " + puzzleState.solutionCycles + ", bytes: " + puzzleState.solutionBytes + ")"));
                } else if (!puzzleState.viewed) {
                    li.appendChild(document.createTextNode(" (NEW)"));
                }

                elements.puzzleList.appendChild(li);
            }
        })(i);
    }

    showMessage("Program Inventory", elements.contentSelect);
}

// Interpreter
var interpreter;
elements.inputLoad.onclick = function () {
    try {
        var sourceLines = elements.inputSource.value.split("\n");
        clearChildren(elements.stateSource);

        highlighter.deleteGroup("source");
        for (var i = 0; i < sourceLines.length; i++) {
            var line = sourceLines[i];
            if (/\S/.test(line)) {
                var div = document.createElement("div");
                div.appendChild(document.createTextNode(line));
        
                highlighter.add("source", i, div);
                elements.stateSource.appendChild(div);
            } else {
                elements.stateSource.appendChild(document.createElement("br"));
            }
        }

        setState(StateFlags.none);

        var inputIndex = 0;
        var outputIndex = 0;
        var done = false;
        interpreter = new Interpreter(
            (new Parser()).assemble(sourceLines),
            {
                readInput: function () {
                    var value = (inputIndex < inputBytes.length) ? inputBytes[inputIndex] : 0;
                    inputIndex++;
                    return value;
                },

                writeOutput: function (value) {
                    if (outputIndex < expectedOutputBytes.length) {
                        ioActualMap[outputIndex].firstChild.nodeValue = value;

                        if (value !== expectedOutputBytes[outputIndex]) {
                            setStateFlag(StateFlags.error);
                            highlighter.highlight("data1", outputIndex, "attention", true);
                            highlighter.highlight("data2", outputIndex, "attention", true);
                        }

                        if (++outputIndex == expectedOutputBytes.length) {
                            done = true;
                        }
                    }
                },

                onWriteMemory: function (address, value) {
                    memoryMap[address].textNode.nodeValue = hexifyByte(value);
                },

                onStateUpdated: function (running, address, target, sourceLineNumber, source, cycles, bytes) {
                    setStateFlag(StateFlags.running, running);

                    elements.stateCycles.firstChild.nodeValue = cycles;
                    elements.stateBytes.firstChild.nodeValue = bytes;

                    // TODO: Use constants from lib
                    if (address < 256 - 3) {
                        highlighter.highlight("source", sourceLineNumber, "emphasize");
                        for (var i = address; i < address + 3; i++) {
                            highlighter.highlight("memory", i, "emphasize");
                        }
                    }

                    if (done) {
                        setStateFlag(StateFlags.done, true);
                    }
                }
            }
        );
    } catch (e) {
        if (e instanceof CompilationError) {
            elements.messageError.firstChild.nodeValue = e.message;
            showMessage("Compilation error", elements.contentCompilationError);
        } else {
            throw e;
        }
    }
};

elements.inputStop.onclick = function () {
    setState(StateFlags.none);
};

elements.inputStep.onclick = function () {
    if (interpreter) {
        highlighter.clear(false);
        interpreter.step();
    }
};

function showWelcome() {
    showMessage("Welcome", elements.contentWelcome, true);
}

elements.inputMenu.onclick = function () {
    showPuzzleList();
};

window.onkeyup = function (e) {
    if (e.keyCode === 27) { // Escape key
        if (messageBoxOpen && !modalMessageBoxOpen) {
            closeMessageBox();
        } else {
            showPuzzleList();
        }
    }
};

function savePuzzleProgress() {
    // Save current code
    var code = elements.inputSource.value;
    if (code === currentPuzzle.code) {
        code = null;
    }

    var puzzleState = loadPuzzlePersistentState(currentPuzzle.title);
    if (puzzleState.code !== code) {
        puzzleState.code = code;
        savePuzzlePersistentState(currentPuzzle.title);
    }
}

elements.inputSource.addEventListener("focusout", function () {
    savePuzzleProgress();
});

// Initial state
var persistentState = loadPersistentState();

// Only show welcome the first time
if (!persistentState.introShown) {
    showWelcome(true);
    persistentState.introShown = true;
    savePersistentState();
}

// Load the last open puzzle
var puzzleIndex = 0;
if (persistentState.currentPuzzle) {
    for (var i = 0; i < puzzles.length; i++) {
        if (puzzles[i].title === persistentState.currentPuzzle) {
            puzzleIndex = i;
            break;
        }
    }
}

loadPuzzle(puzzles[puzzleIndex]);
