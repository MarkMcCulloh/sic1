var elements = {
    inputSource: "input",
    inputBytes: "inputBytes",
    inputLoad: "load",
    inputStep: "step",
    inputRun: "run",
    stateSource: "source",
    stateMemory: "memory",
    stateRunning: "running",
    stateCycles: "cycles",
    stateBytes: "bytes",
    output: "output"
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

function hexifyByte(v) {
    var str = v.toString(16);
    if (str.length == 1) {
        str = "0" + str;
    }
    return str;
}

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

        tr.appendChild(td);
    }

    elements.stateMemory.appendChild(tr);
}

var instructionPointerHighlightClass = "ip";
function highlightInstruction(address, highlight) {
    for (var i = address; i < address + 3 && i < 256; i++) {
        var classList = memoryMap[i].td.classList;
        if (highlight) {
            classList.add(instructionPointerHighlightClass);
        } else { 
            classList.remove(instructionPointerHighlightClass);
        }
    }
}

// Interpreter
var interpreter;
var previousAddress;
elements.inputLoad.onclick = function () {
    var sourceLines = elements.inputSource.value.split("\n");
    var inputBytes = [];
    try {
        inputBytes = elements.inputBytes.value
            .split(/\s/)
            .map(function (a) {
                var n = parseInt(a);
                if (n < -128 || n> 127) {
                    throw "Input value outside range of [-128, 127]: " + a;
                }
                return n;
            });
    } catch (e) {}

    clearChildren(elements.output);
    clearChildren(elements.stateSource);

    var sourceElements = [];
    for (var i = 0; i < sourceLines.length; i++) {
        var line = sourceLines[i];
        if (/\S/.test(line)) {
            var p = document.createElement("p");
            p.appendChild(document.createTextNode(line));
    
            sourceElements[i] = p;
            elements.stateSource.appendChild(p);
        } else {
            elements.stateSource.appendChild(document.createElement("br"));
        }
    }

    var inputIndex = 0;
    var previousSourceElement;
    interpreter = new Interpreter(
        (new Parser()).assemble(sourceLines),
        {
            readInput: function () {
                var value = (inputIndex < inputBytes.length) ? inputBytes[inputIndex] : 0;
                inputIndex++;
                return value;
            },

            writeOutput: function (value) {
                elements.output.appendChild(document.createTextNode(value));
                elements.output.appendChild(document.createElement("br"));
            },

            onWriteMemory: function (address, value) {
                memoryMap[address].textNode.nodeValue = hexifyByte(value);
            },

            onStateUpdated: function (running, address, sourceLineNumber, source, cycles, bytes) {
                elements.stateRunning.innerText = running ? "Running" : "Stopped";
                elements.stateCycles.innerText = cycles;
                elements.stateBytes.innerText = bytes;

                highlightInstruction(address, true);
                if (previousAddress !== undefined) {
                    highlightInstruction(previousAddress, false);
                }
                previousAddress = address;

                var sourceElement = (address === 255) ? undefined : sourceElements[sourceLineNumber];
                if (sourceElement) {
                    sourceElement.classList.add(instructionPointerHighlightClass);
                }
                if (previousSourceElement) {
                    previousSourceElement.classList.remove(instructionPointerHighlightClass);
                }
                previousSourceElement = sourceElement;
            },

            onHalt: function (cycles, bytes) {

            }
        }
    );

    elements.inputStep.disabled = false;
    // elements.inputRun.disabled = false;
};

elements.inputStep.onclick = function () {
    if (interpreter) {
        interpreter.step();
    }
};

elements.inputRun.onclick = function () {
    // TODO
};