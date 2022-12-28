### Single Instruction Computer Mark 1 (SIC-1)
The Single Instruction Computer Mark 1 (SIC-1) is an 8-bit computer with 256 bytes of memory. Programs for the SIC-1 are written in SIC-1 Assembly Language, as described below.

### subleq instruction
Each `subleq` instruction is 3 bytes, specified as follows:

```
subleq <A> <B> [<C>]
```

`A`, `B`, and `C` are memory addresses (0 - 255) or labels.

`subleq` subtracts the value at address `B` from the value at address `A` and stores the result at address `A` (i.e. `mem[A]` is set to `mem[A] - mem[B]`).

If the result is <= 0, execution branches to address `C`.

Note that if `C` is not specified, the address of the next instruction is automatically added by the assembler (in effect, this means that taking the branch is no different from advancing to the next instruction).

### Built-in addresses
For convenience, addresses can be specified using labels. The following predefined labels are always available:

 * `@MAX` (252): Maximum user-modifiable address
 * `@IN` (253): Reads a value from input (writes are ignored)
 * `@OUT` (254): Writes a result to output (reads as zero)
 * `@HALT` (255): Terminates the program when accessed

### subleq example
Below is a very simple SIC-1 program that negates one input value and writes it out.

E.g. if the input value from `@IN` is 3, it subtracts 3 from `@OUT` (which reads as zero), and the result of 0 - 3 = -3 is written out.

```
subleq @OUT, @IN
```

### Comments
Any text following a semicolon is considered a comment. Comments are ignored by the assembler, but may be helpful to humans attempting to decipher existing programs. For example, here's the previous line of assembly with an explanatory comment:

```
subleq @OUT, @IN ; Negates an input and writes it out
```

### Labels
Custom labels are defined by putting `@name: ` at the beginning of a line, e.g.:

```
@loop: subleq 1, 2
```

Label names can only contain letters (a-z, A-Z), numbers (0-9), and underscores (_).

### .data directive
In addition to `subleq`, there is an assembler directive `.data` that sets a byte of memory to a value at compile time (note: this is not an instruction!):

```
.data <X>
```

`X` is a signed byte between -128 and 127 (inclusive).

### Constants and variables
Combining labels and the `.data` directive allows you to develop of system of constants and variables. For example, here a byte is set to zero, and the label `@zero` points to that value:

```
@zero: .data 0
```

### Unconditional jumps
Variables can be used for implementing an unconditional jump:

```
subleq @zero, @zero, @next
```

This will set `@zero` to zero minus zero (still zero) and, since the result is always <= 0, execution always branches to the label `@next`.

### Loop example
Below is an updated negation program that repeatedly negates input values and writes them out in a loop.

```
@loop:
subleq @OUT, @IN           ; Negate an input and write it out
subleq @zero, @zero, @loop ; Unconditional jump to @loop

@zero: .data 0             ; Always zero
```

### Label offsets
Label expressions can include an optional offset. For example, `@loop+1` refers to the second byte of the instruction pointed to by `@loop`:

```
@loop:
subleq @loop+1, @one
```

### Reflection example
Label offsets are useful in self-modifying code. Remember, each `subleq` instruction is stored as 3 consecutive addresses: `ABC` (for `mem[A] ← mem[A] - mem[B]`, with a branch to `C` if the result is less than or equal to zero).

The sample program below reads its own compiled code and outputs it by incrementing the second address of the instruction at `@loop` (i.e. modifying address `@loop+1`).

```
@loop:
subleq @tmp, 0           ; Second address (initially zero) will be incremented below
subleq @OUT, @tmp        ; Output the value
subleq @loop+1, @n_one   ; Here is where the increment is performed
subleq @tmp, @tmp, @loop ; Reset @tmp to zero and unconditionally jump to @loop

@tmp: .data 0            ; @tmp is initialized to zero
@n_one: .data -1
```

The third instruction is an example of self-modifying code because it actually modifies the first instruction. Specifically, it increments the first instruction's second address (`@loop+1`). This causes the *next* loop iteration's first instruction to read the *next* byte of memory (0, 1, 2, 3, ...).

Note: When running a program in the SIC-1 Development Environment, the original (unmodified) source code is always shown. If the program modifies itself, the changes are reflected in the memory table in the top right, but *not* in the source code viewer.

### Stack example
This program implements a last-in, first-out stack by modifying the read and write addresses of the instructions that interact with the stack.

The program pushes 3 (defined by `@count`) input values onto the stack and then pops them off (outputting them in reverse order).

```
; The first address of this instruction (which starts
; pointing to @stack) will be incremented with each
; write to the stack
@stack_push:
subleq @stack, @IN
subleq @count, @one, @prepare_to_pop

; Modify the instruction at @stack_push (increment
; target address)
subleq @stack_push, @n_one
subleq @tmp, @tmp, @stack_push

; Prepare to start popping values off of the stack by
; copying the current stack position to @stack_pop+1
@prepare_to_pop:
subleq @tmp, @stack_push
subleq @stack_pop+1, @tmp

; Read a value from the stack (note: the second address
; of this instruction is repeatedly decremented)
@stack_pop:
subleq @OUT, 0

; Decrement stack address in the instruction at @stack_pop
subleq @stack_pop+1, @one
subleq @tmp, @tmp, @stack_pop

; Constants
@one: .data 1
@n_one: .data -1

; Variables
@tmp: .data 0
@count: .data 3

; Base of stack (stack will grow upwards)
@stack: .data 0
```

### Characters
When configured properly, the SIC-1 supports natural human language input and output using a highly modern (c. 1967) mapping from numbers to characters known as ASCII. For example, 72 is mapped to "H" (capital "h").

To capture the characters "Hi" (capital "h", lower case "i") in two variables, one could consult an ASCII lookup table and write:

```
@H: .data 72
@i: .data 105
```

Consulting an ASCII table is tedious, so to make SIC Systems engineers' lives easier, SIC-1 Assembly Language now supports automated ASCII lookup using the following advanced syntax (which is equivalent to explicitly specifying characters' mapped numbers):

```
@H: .data 'H' ; 72
@i: .data 'i' ; 105
```

As a final convenience, it is possible to negate the value of a character by prefixing the character literal with a minus:

```
@n_H: .data -'H' ; -72
```

### Character output example
The following sample program outputs the characters "Hi":

```
subleq @OUT, @n_H ; Note: (0 - (-72) = 72 = 'H')
subleq @OUT, @n_i

@n_H: .data -'H'
@n_i: .data -'i'
```

### Strings
Strings are sequences of characters that are terminated with a zero. In the following example, @string points to a 3 byte sequence representing the string "Hi":

```
@string:
.data 'H'
.data 'i'
.data 0
```

Although not discussed previously, the .data directive can actually take a sequence of values to set multiple bytes, so the previous code would be simplified:

```
@string: .data 'H', 'i', 0
```

And thanks to the innovative design-by-committee approach employed by SIC Systems, the following novel syntax for strings can be used (again, equivalent to the other examples):

```
@string: .data "Hi" ; Sets the next 3 bytes: 'H', 'i', 0
```

Similar to character values, an entire string can be negated by prefixing it with a minus:

```
@n_string: .data -"Hi" ; Sets the next 3 bytes: -72, -105, 0
```

### New line characters
New line characters (value 10) can be expressed with the character `'\n'`. They can also be used in strings, for example: `"Line 1\nLine 2"`.

### String output example
The following code outputs "Hello, world!":

```
@loop:
subleq @OUT, @n_message  ; Read address starts at @n_message
subleq @loop+1, @n_one   ; Advance read address
subleq @tmp, @tmp, @loop

@n_one: .data -1
@n_message: .data -"Hello, world!"
@tmp: .data 0
```
