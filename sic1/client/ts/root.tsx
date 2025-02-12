import { Assembler, Command, CompilationError } from "sic1asm";
import { puzzles, puzzleCount, puzzleFlatArray } from "sic1-shared";
import { Platform } from "./platform";
import { menuBehavior, MessageBox, MessageBoxContent } from "./message-box";
import { Shared } from "./shared";
import { TextButton } from "./text-button";
import { ChartState } from "./chart";
import { currentUserDataGeneration, Sic1DataManager } from "./data-manager";
import { LeaderboardEntry, Sic1WebService, StatChanges } from "./service";
import { Sic1Ide } from "./ide";
import { addMailForPuzzle, addTriggeredMail, ensureSolutionStatsMailUnread, hasUnreadMail, migrateInbox, updateSessionStats } from "./mail";
import { MailViewer } from "./mail-viewer";
import licenses from "./licenses";
import { Component, ComponentChild, ComponentChildren, createRef } from "preact";
import { PuzzleList, PuzzleListTypes } from "./puzzle-list";
import { Music } from "./music";
import { SoundEffects } from "./sound-effects";
import { Button } from "./button";
import { Achievement, achievements, jobTitleAchievementIds } from "./achievements";
import { AvoisionUI } from "./avoision-ui";
import { Toaster } from "./toaster";
import { loadImageAsync } from "./image-cache";
import packageJson from "../package.json";
import { ColorScheme, colorSchemeNames } from "./colors";
import { ClientPuzzle, clientPuzzles, puzzleSandbox } from "./puzzles";

function Link(props: { title: string, link: string }) {
    const { title, link } = props;
    return <a href={link} target="_blank">{title}</a>;
}

class Sic1UserProfileForm extends Component<{ onCompleted: (name: string, uploadName: boolean) => void }> {
    private inputName = createRef<HTMLInputElement>();
    private inputUploadName = createRef<HTMLInputElement>();

    public submit() {
        this.props.onCompleted(this.inputName.current.value, this.inputUploadName.current.checked);
    }

    public render() {
        const data = Sic1DataManager.getData();

        return <form onSubmit={(event) => {
                event.preventDefault();
                this.submit();
            }}>
                <label>Name: <input
                    ref={this.inputName}
                    autoFocus={true}
                    maxLength={Sic1WebService.userNameMaxLength}
                    defaultValue={data.name || Shared.defaultName}
                    /></label>
                <p><label><input
                    ref={this.inputUploadName} type="checkbox"
                    defaultChecked={(typeof(data.uploadName) === "boolean") ? data.uploadName : true}
                    /> Show my name in public leaderboards (if unchecked, your statistics will be shown without a name)</label></p>
            </form>;
    }
}

interface Sic1LeaderboardState {
    chartState: ChartState;
    data?: LeaderboardEntry[];
}

class Sic1Leaderboard extends Component<{ promise: Promise<LeaderboardEntry[]> }, Sic1LeaderboardState> {
    constructor(props) {
        super(props);
        this.state = { chartState: ChartState.loading };
    }

    public async componentDidMount() {
        try {
            this.setState({
                chartState: ChartState.loaded,
                data: await this.props.promise,
            });
        } catch (error) {
            this.setState({ chartState: ChartState.loadFailed });
        }
    }

    public render() {
        let body: ComponentChildren;
        switch (this.state.chartState) {
            case ChartState.loading:
                body = <td colSpan={2} className="center">(Loading...)</td>;
                break;

            case ChartState.loaded:
                body = this.state.data.map(row =>
                    <tr>
                        <td className={"text" + ((row.name.length > 0) ? "" : " deemphasize")}>{(row.name.length > 0) ? `${row.name} (${Shared.getJobTitleForSolvedCount(row.solved)})` : "(anonymous)"}</td>
                        <td>{row.solved}</td>
                    </tr>);
                break;

            default:
                body = <td colSpan={2} className="center">(Load failed)</td>;
                break;
        }

        return <table>
            <thead><tr><th>Name</th><th>Tasks Completed</th></tr></thead>
            <tbody>{body}</tbody>
        </table>;
    }
}

interface ZoomSliderProps {
    zoom: number;
    onZoomUpdated: (zoom: number) => void;
}

class ZoomSlider extends Component<ZoomSliderProps> {
    constructor(props) {
        super(props);
    }

    public render(): ComponentChild {
        return <label>Zoom:
            <input
                type="range"
                min={0.6}
                max={2}
                step={0.2}
                defaultValue={`${this.props.zoom}`}
                onChange={(event) => this.props.onZoomUpdated(parseFloat(event.currentTarget.value))}
                />
        </label>;
    }
}

interface Sic1CheckboxInstanceProps {
    position: "left" | "right";
    value: boolean;
    onUpdated: (value: boolean) => void;
}

type Sic1CheckboxProps = Sic1CheckboxInstanceProps & {
    labelAfter: string;
    labelBefore: string;
}

class Sic1Checkbox extends Component<Sic1CheckboxProps> {
    public render(): ComponentChild {
        const checkbox = <input
            className={this.props.position}
            type="checkbox"
            onChange={(event) => this.props.onUpdated(event.currentTarget.checked)}
            defaultChecked={this.props.value}
            />;

        if (this.props.position === "left") {
            return <label>{checkbox} {this.props.labelAfter}</label>;
        } else {
            return <label>{this.props.labelBefore}: {checkbox}</label>;
        }
    }
}

class Sic1SoundCheckbox extends Component<Sic1CheckboxInstanceProps> {
    public render(): ComponentChild {
        return <Sic1Checkbox labelBefore="Sound effects" labelAfter="Enable sound effects" {...this.props} />;
    }
}

class Sic1MusicCheckbox extends Component<Sic1CheckboxInstanceProps> {
    public render(): ComponentChild {
        return <Sic1Checkbox labelBefore="Music" labelAfter="Enable music" {...this.props} />;
    }
}

interface Sic1PresentationSettingsProps {
    fullscreen: boolean;
    onFullscreenUpdated: (fullscreen: boolean) => void;
    zoom: number;
    onZoomUpdated: (zoom: number) => void;
    colorScheme: ColorScheme;
    onColorSchemeUpdated: (colorScheme: ColorScheme) => void;

    soundEffects: boolean;
    onSoundEffectsUpdated: (soundEffects: boolean) => void;
    soundVolume: number;
    onSoundVolumeUpdated: (volume: number) => void;

    music: boolean;
    onMusicUpdated: (music: boolean) => void;
    musicVolume: number;
    onMusicVolumeUpdated: (volume: number) => void;
}

class Sic1PresentationSettings extends Component<Sic1PresentationSettingsProps> {
    public render(): ComponentChild {
        return <>
            <form onSubmit={(event) => event.preventDefault()}>
                <label>Fullscreen: <input
                    className="right"
                    type="checkbox"
                    defaultChecked={this.props.fullscreen && Platform.fullscreen.get()}
                    onChange={(event) => this.props.onFullscreenUpdated(event.currentTarget.checked) }
                    /></label>
                <ZoomSlider
                    zoom={this.props.zoom}
                    onZoomUpdated={this.props.onZoomUpdated}
                    />
                <label>Color scheme:&nbsp;<select onChange={(event) => this.props.onColorSchemeUpdated(event.currentTarget.value as ColorScheme)}>
                    {colorSchemeNames.map(name => <option selected={name === this.props.colorScheme}>{name}</option>)}
                </select></label>
                <br/>
                <Sic1SoundCheckbox position="right" value={this.props.soundEffects} onUpdated={this.props.onSoundEffectsUpdated} />
                <label>Sound effects volume:
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={false}
                        defaultValue={`${this.props.soundVolume}`}
                        onChange={(event) => { this.props.onSoundVolumeUpdated(parseFloat(event.currentTarget.value)) } }
                        />
                </label>
                <br/>
                <Sic1MusicCheckbox position="right" value={this.props.music} onUpdated={this.props.onMusicUpdated} />
                <label>Music volume:
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={false}
                        defaultValue={`${this.props.musicVolume}`}
                        onChange={(event) => { this.props.onMusicVolumeUpdated(parseFloat(event.currentTarget.value)) } }
                        />
                </label>
            </form>
        </>;
    }
}

interface Sic1RootProps extends Sic1PresentationSettingsProps {
}

interface Sic1RootPuzzleState {
    puzzle: ClientPuzzle;
    solutionName: string;
    defaultCode: string;
}

interface Sic1RootState extends Sic1RootPuzzleState {
    messageBoxQueue: MessageBoxContent[];
    previousFocus?: Element;
}

export class Sic1Root extends Component<Sic1RootProps, Sic1RootState> {
    private static readonly manualMailId = "s0_0";

    private ide = createRef<Sic1Ide>();
    private toaster = createRef<Toaster>();
    private userProfileForm = createRef<Sic1UserProfileForm>();
    private mailViewer = createRef<MailViewer>();
    private achievements: { [achievement: string]: boolean } = {};

    constructor(props) {
        super(props);

        // User data migration
        migrateInbox();

        // Add epilogue on launch after completing the last puzzle
        if (Sic1DataManager.getData().solvedCount >= puzzleCount) {
            addTriggeredMail("epilogue");
        }

        // Load previous puzzle, if available
        const previousPuzzleTitle = Sic1DataManager.getData().currentPuzzle;
        const puzzle = clientPuzzles.find(p => p.title === previousPuzzleTitle) ?? puzzles[0].list[0];
        const { currentSolutionName } = Sic1DataManager.getPuzzleData(puzzle.title);
        const { solution } = Sic1DataManager.getPuzzleDataAndSolution(puzzle.title, currentSolutionName);

        const { defaultCode } = Sic1Root.getStateForPuzzle(puzzle, solution.name);
        this.state ={
            puzzle,
            solutionName: solution.name,
            defaultCode,
            messageBoxQueue: [],
        }
    }

    private static wrapComments(code: string): string {
        const maxLineLength = 68;
        const lines = code.split("\n");
        const result: string[] = [];
        const addCommentPrefix = (s: string) => `; ${s}`;
        for (const line of lines) {
            if (line.startsWith("; ") && line.charAt(2) !== " ") {
                let l = line.replace(/^;[ ]*/, "");
                while (true) {
                    if (l.length <= maxLineLength) {
                        result.push(addCommentPrefix(l));
                        break;
                    }
    
                    const end = l.lastIndexOf(" ", maxLineLength - 1);
                    if (end < 0) {
                        result.push(addCommentPrefix(l));
                        break;
                    }
    
                    result.push(addCommentPrefix(l.substring(0, end)));
                    l = l.substring(end + 1);
                }
            } else {
                result.push(line);
            }
        }
        return result.join("\n");
    }

    private static getUnmodifiedCode(puzzle: ClientPuzzle) {
        const prewrappedCode = puzzle.code || `; ${puzzle.description}\n`;
        return Sic1Root.wrapComments(prewrappedCode);
    }

    private static getDefaultCode(puzzle: ClientPuzzle, solutionName: string) {
        // Load progress (or fallback to default)
        const { solution } = Sic1DataManager.getPuzzleDataAndSolution(puzzle.title, solutionName);
        let code = solution.code;
        if (code === undefined || code === null) {
            code = Sic1Root.getUnmodifiedCode(puzzle);
        }
        return code;
    }

    private static getStateForPuzzle(puzzle: ClientPuzzle, solutionName: string): Sic1RootPuzzleState {
        return {
            puzzle,
            solutionName,
            defaultCode: Sic1Root.getDefaultCode(puzzle, solutionName),
        };
    }

    private playSoundCorrect = Shared.createFunctionWithMinimumPeriod(() => SoundEffects.play("correct"), 50);

    private playSoundIncorrect(): void {
        SoundEffects.stop("correct");
        SoundEffects.play("incorrect");
    }

    private playSoundCompleted(): void {
        SoundEffects.stop("correct");
        SoundEffects.play("completed");
    }

    private saveProgress(): void {
        if (this.ide.current) {
            const { puzzle, solutionName } = this.state;
            let code = this.ide.current.getCode();
            if (code === Sic1Root.getUnmodifiedCode(puzzle)) {
                code = null;
            }

            const { puzzleData, solution } = Sic1DataManager.getPuzzleDataAndSolution(puzzle.title, solutionName);
            if (solution.code !== code) {
                solution.code = code;
                Sic1DataManager.savePuzzleData(puzzle.title);
            }
        }
    }

    private loadPuzzle(puzzle: ClientPuzzle, solutionName: string): void {
        // Save progress on previous puzzle
        this.saveProgress();

        // Save as last open puzzle
        const data = Sic1DataManager.getData();
        if (data.currentPuzzle !== puzzle.title) {
            data.currentPuzzle = puzzle.title;
            Sic1DataManager.saveData();
        }

        // Mark new puzzle as viewed
        const puzzleData = Sic1DataManager.getPuzzleData(puzzle.title);
        let puzzleDataModified = false;
        if (!puzzleData.viewed) {
            puzzleData.viewed = true;
            puzzleDataModified = true;
        }

        // Mark as last open solution for this puzzle
        if (puzzleData.currentSolutionName !== solutionName) {
            puzzleData.currentSolutionName = solutionName;
            puzzleDataModified = true;
        }

        if (puzzleDataModified) {
            Sic1DataManager.savePuzzleData(puzzle.title);
        }

        this.setState(Sic1Root.getStateForPuzzle(puzzle, solutionName));
        if (this.ide.current) {
            this.ide.current.reset(puzzle, solutionName);
        }

        this.messageBoxClear();
    }

    private recordAchievement(achievement: Achievement): void {
        // Note: This is not persisted and is only for this session
        const achievements = this.achievements;
        if (achievements[achievement] !== true) {
            achievements[achievement] = true;
        }
    }

    private async showAchievementNotificationAsync(achievement: Achievement): Promise<void> {
        const achievementInfo = achievements[achievement];
        const image = await loadImageAsync(achievementInfo.imageUri, 64, 64);
        if (this.toaster.current) {
            this.toaster.current.enqueue({
                image,
                title: "Achievement Unlocked",
                text: achievementInfo.title,
            });
        }
    }

    private ensureAchievement(achievement: Achievement): void {
        if (this.achievements[achievement] === true) {
            return;
        }

        Platform.setAchievementAsync(achievement).then(newlyAchieved => {
            this.recordAchievement(achievement);

            if (newlyAchieved && Platform.shouldShowAchievementNotification?.()) {
                this.showAchievementNotificationAsync(achievement);
            }
        });
    }

    private ensureJobTitleAchievements(): void {
        const data = Sic1DataManager.getData();
        for (let i = 1; i < Shared.jobTitles.length && (i - 1) < jobTitleAchievementIds.length; i++) {
            const job = Shared.jobTitles[i];
            if (job.minimumSolved <= data.solvedCount) {
                this.ensureAchievement(jobTitleAchievementIds[i - 1]);
            } else {
                break;
            }
        }
    }

    private checkForSolutionAchievements(): void {
        // Ensure job title-associated achievements are set
        this.ensureJobTitleAchievements();

        // Check for time-based achievements
        const now = new Date();
        if (now.getHours() < 6) {
            this.ensureAchievement("TIME_EARLY");
        } else if (now.getHours() >= 21) {
            this.ensureAchievement("TIME_LATE");
        }

        // Check for "no subleq" achievement
        if (this.state.puzzle.title === "Addition") {
            const noSubleq = this.ide.current.getCode()
                .split("\n")
                .map(line => Assembler.parseLine(line).command)
                .every(command => (command !== Command.subleqInstruction));

            if (noSubleq) {
                this.ensureAchievement("OMIT_SUBLEQ");
            }
        }
    }

    private puzzleCompleted(cycles: number, bytes: number, programBytes: number[]): void {
        // Mark as solved in persistent state
        const { puzzle, solutionName } = this.state;
        const { puzzleData, solution } = Sic1DataManager.getPuzzleDataAndSolution(puzzle.title, solutionName);
        const data = Sic1DataManager.getData();
        const solvedCountOld = data.solvedCount;
        const cyclesOld = puzzleData.solutionCycles;
        const bytesOld = puzzleData.solutionBytes;

        let puzzleDataModified = false;
        if (!puzzleData.solved) {
            data.solvedCount = Math.min(puzzleCount, data.solvedCount + 1);

            puzzleData.solved = true;
            puzzleData.solutionCycles = cycles;
            puzzleData.solutionBytes = bytes;

            Sic1DataManager.saveData();
            puzzleDataModified = true;
        } else if (cycles < puzzleData.solutionCycles || bytes < puzzleData.solutionBytes) {
            puzzleData.solutionCycles = Math.min(puzzleData.solutionCycles, cycles);
            puzzleData.solutionBytes = Math.min(puzzleData.solutionBytes, bytes);
            puzzleDataModified = true;
        }

        if ((cycles !== solution.solutionCycles) || (bytes !== solution.solutionBytes)) {
            solution.solutionCycles = cycles;
            solution.solutionBytes = bytes;
            puzzleDataModified = true;
        }

        if (puzzleDataModified) {
            Sic1DataManager.savePuzzleData(puzzle.title);
        }

        // Prepare a list of potential changes
        const statChanges: StatChanges = {
            solvedCount: {
                improved: (solvedCountOld === undefined) || (data.solvedCount > solvedCountOld),
                oldScore: solvedCountOld,
                newScore: data.solvedCount,
            },
            cycles: {
                improved: (cyclesOld === undefined) || (cycles < cyclesOld),
                oldScore: cyclesOld,
                newScore: cycles,
            },
            bytes: {
                improved: (bytesOld === undefined) || (bytes < bytesOld),
                oldScore: bytesOld,
                newScore: bytes,
            },
        }

        // Check for new mail
        addMailForPuzzle(puzzle.title);

        // Force the automated stats mail to be unread
        ensureSolutionStatsMailUnread(puzzle.title);

        // Start uploading solution/stats
        const leaderboardPromises = Platform.service.updateStatsIfNeededAsync(data.userId, puzzle.title, programBytes, statChanges);

        // Update session stats (and any leaderboard update+loading promises) so they'll be shown in the mail viewer
        updateSessionStats(puzzle.title, cycles, bytes, leaderboardPromises);

        this.messageBoxPush(this.createMessageMailViewer(puzzle.title));
        this.checkForSolutionAchievements();
    }

    /** Gets the title of the next unsolved puzzle, or null if all puzzles have been solved. "Next" meaning the current
     * puzzle if it's unsolved, otherwise the next higher one, wrapping around, if needed. */
    private getNextPuzzle(): ClientPuzzle | null {
        if (!Sic1DataManager.getPuzzleData(this.state.puzzle.title).solved) {
            return this.state.puzzle;
        }

        const currentPuzzleTitle = this.state.puzzle.title;
        const currentPuzzleIndex = puzzleFlatArray.findIndex(p => p.title === currentPuzzleTitle);
        if (currentPuzzleIndex >= 0) {
            let index = currentPuzzleIndex;
            do {
                index = (index + 1) % puzzleCount;
            } while (index !== currentPuzzleIndex && Sic1DataManager.getPuzzleData(puzzleFlatArray[index].title).solved);
            if (index !== currentPuzzleIndex) {
                return puzzleFlatArray[index];
            }
        }
        return null;
    }

    private toggleMenu() {
        if (this.state.messageBoxQueue.length > 0) {
            if (this.state.messageBoxQueue[0].modal !== true) {
                this.messageBoxPop();
            }
        } else {
            this.messageBoxPush(this.createMessageMenu());
        }
    }

    private beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        this.saveProgress();
    };

    private keyDownHandler = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            if (this.state.messageBoxQueue.length > 0) {
                if (this.state.messageBoxQueue[0].modal !== true) {
                    this.messageBoxPop();
                }
            } else if (this.ide.current && this.ide.current.pauseOrStop()) {
                // Already handled
            } else {
                this.messageBoxPush(this.createMessageMenu());
            }
        }
    }

    private updateUserProfile(name: string, uploadName: boolean | undefined, callback: () => void) {
        const data = Sic1DataManager.getData();
        data.name = name;
        if (uploadName !== undefined) {
            data.uploadName = uploadName;
        }

        data.introCompleted = true;
        Sic1DataManager.saveData();

        // No need to wait for completion
        Platform.service.updateUserProfileAsync(data.userId, uploadName ? name : "").catch(() => {});

        callback();
    }

    private openManualInGame(): void {
        this.messageBoxClear();
        this.messageBoxPush(this.createMessageMailViewer(Sic1Root.manualMailId));
    }

    private openManualInNewWindow(clearMessageBox: boolean): void {
        if (clearMessageBox) {
            this.messageBoxClear();
        }
        Platform.openManual();
    }

    private createMessageIntro(): MessageBoxContent {
        return {
            title: "Job Application",
            modal: true,
            body: <>
                <h3>JOB DESCRIPTION:</h3>
                <p>SIC Systems is looking for experienced programmers to join our team!</p>
                <p>As an engineer at SIC Systems, you'll produce highly efficient programs for our flagship product: the Single Instruction Computer Mark 1 (SIC-1). You will be competing against other engineers to produce the fastest and smallest programs.</p>
                <p>This is a full-time salaried role. The ideal candidate for this job will have a PhD and 15 - 20 years (or more) of industry experience, along with a relentless attention to detail and exemplary interpersonal skills. Scheduling flexibility is a plus, as we push toward our worldwide launch.</p>
                <h3>ABOUT SIC SYSTEMS:</h3>
                <p>SIC Systems is the world leader in single-instruction computing. Our mission is to simplify computation, and thus simplify the world. We are innovative, trustworthy, and ethical.</p>
                {
                    Platform.disableUserNameUpload
                    ? <>
                        <p>Click the button below to submit your job application:</p>
                        <br/><Button onClick={() => this.updateUserProfile("", undefined, () => this.messageBoxReplace(this.createMessageMailViewer()))}>Apply for the Job</Button>
                    </>
                    : <>
                        <h3>JOB APPLICATION:</h3>
                        <p><Sic1UserProfileForm ref={this.userProfileForm} onCompleted={(name, uploadName) => this.updateUserProfile(name, uploadName, () => this.messageBoxReplace(this.createMessageMailViewer()))} /></p>
                        <p><Sic1SoundCheckbox position="left" value={this.props.soundEffects} onUpdated={this.props.onSoundEffectsUpdated} /></p>
                        <p><Sic1MusicCheckbox position="left" value={this.props.music} onUpdated={this.props.onMusicUpdated} /></p>
                        <p>After completing the form above, click the button below to submit your job application:</p>
                        <br/><Button onClick={() => this.userProfileForm.current.submit()}>Apply for the Job</Button>
                    </>
                }
            </>
        };
    }

    private createMessageUserProfileEdit(): MessageBoxContent {
        const userId = Sic1DataManager.getData().userId;
        return {
            title: "User Profile",
            body: <>
                <p>Update your user profile as needed:</p>
                <p><Sic1UserProfileForm ref={this.userProfileForm} onCompleted={(name, uploadName) => this.updateUserProfile(name, uploadName, () => this.messageBoxPop())} /></p>
                <p>Note: if you would like to have all of your leaderboard data deleted, send an email to <Link title="sic1data@schemescape.com" link={`mailto:sic1data@schemescape.com?subject=Delete_${userId}`}/> with "{userId}" (your randomly-generated user id) in the subject.</p>
                <br/>
                <Button onClick={() => this.userProfileForm.current.submit()}>Save Changes</Button>
                <Button onClick={() => this.messageBoxPop()}>Cancel</Button>
            </>,
        };
    }

    private createMessageOptions(): MessageBoxContent {
        return {
            title: "Options",
            behavior: menuBehavior,
            body: <>
                <Button onClick={() => {
                    this.messageBoxClear();
                    this.messageBoxPush(this.createMessagePuzzleList("achievements"));
                }}>Achievements</Button>
                {Platform.service.getLeaderboardAsync ? <Button onClick={() => this.messageBoxPush(this.createMessageLeaderboard())}>Leaderboard</Button> : null }
                {Platform.disableUserNameUpload ? null : <Button onClick={() => this.messageBoxPush(this.createMessageUserProfileEdit())}>User Settings</Button>}
                <Button onClick={() => this.messageBoxPush(this.createMessagePresentationSettings())}>Presentation Settings</Button>
                <br/><Button onClick={() => this.messageBoxPush(this.createMessageCredits())}>Credits</Button>
            </>,
        };
    }

    private createMessageManualMenu(): MessageBoxContent {
        return {
            title: "SIC-1 Manual",
            behavior: menuBehavior,
            body: <>
                <Button onClick={() => this.openManualInGame()}>Open Manual In-Game</Button>
                <Button onClick={() => this.openManualInNewWindow(true)}>Open Manual in New Window</Button>
            </>,
        };
    }

    private createMessageMenu(): MessageBoxContent {
        return {
            title: "Main Menu",
            behavior: menuBehavior,
            body: <>
                <Button onClick={() => this.messageBoxReplace(this.createMessagePuzzleList("puzzle", this.state.puzzle.title))}>Program Inventory</Button>
                <Button onClick={() => this.messageBoxReplace(this.createMessageMailViewer())}>Electronic Mail</Button>
                {Sic1DataManager.getData().solvedCount >= puzzleSandbox.minimumSolvedToUnlock
                    ? <><br/><Button onClick={() => this.messageBoxReplace(this.createMessagePuzzleList("puzzle", puzzleSandbox.title))}>Sandbox Mode</Button></>
                    : null}
                {Sic1DataManager.getData().solvedCount >= Shared.avoisionSolvedCountRequired
                    ? <Button onClick={() => this.messageBoxReplace(this.createMessagePuzzleList("avoision"))}>Avoision</Button>
                    : null}
                <br/>
                <Button onClick={() => this.messageBoxPush(this.createMessageManualMenu())}>SIC-1 Manual</Button>
                <br/>
                <Button onClick={() => {this.messageBoxPush(this.createMessageOptions())}}>Options</Button>
                {Platform.app ? <><br/><Button onClick={() => window.close()}>Exit SIC-1</Button></> : null}
            </>,
        };
    }

    private createMessagePresentationSettings(): MessageBoxContent {
        return {
            title: "Presentation",
            behavior: menuBehavior,
            body: <Sic1PresentationSettings {...this.props} />,
        };
    }

    private createMessageMigrationPrompt(): MessageBoxContent {
        return {
            title: "Welcome back!",
            modal: true,
            body: <>
                <p>Welcome back! It looks like you've played SIC-1 before.</p>
                <p>The following optional features have been added, so take a moment to enable them if you're interested:</p>
                <p><Sic1SoundCheckbox position="left" value={this.props.soundEffects} onUpdated={this.props.onSoundEffectsUpdated} /></p>
                <p><Sic1MusicCheckbox position="left" value={this.props.music} onUpdated={this.props.onMusicUpdated} /></p>
                <br/><Button onClick={() => {
                    Sic1DataManager.getData().generation = currentUserDataGeneration;
                    Sic1DataManager.saveData();
                    this.messageBoxPop();
                }}>Save Changes</Button>
            </>,
        };
    }

    private createMessageLicenses(): MessageBoxContent {
        return {
            title: "Licenses",
            width: "wide",
            body: <>
                <h2>Third Party Licenses</h2>
                <pre className="licenses">{licenses}</pre>
            </>,
        };
    }

    private createMessageCredits(): MessageBoxContent {
        return {
            title: "Credits",
            body: <>
                <div className="version">v{packageJson.version}</div>
                <h3 className="logo">SIC-1</h3>
                <p className="creditSubtitle">by <Link title="Anti-Pattern Games" link="https://www.antipatterngames.com/"/></p>
                <p>Thanks for playing! Hopefully you enjoyed it (or at least learned something in the process).</p>
                <h3>Background</h3>
                <p>I originally made this game because I was interested in single-instruction programming languages and I thought that the zachlike genre (originated by <Link title="Zachtronics" link="https://www.zachtronics.com/"/>) would be a fun way to explore the concept.</p>
                <p>After seeing quite a few people charging up the leaderboards, I decided to add more puzzles and eventually turn this into a full-fledged game (including writing a narrative and some music--both things I hadn't really attempted before, as you can likely tell).</p>
                <h3>Indieware</h3>
                <p>Although I spent a ridiculous number of hours making this game, I decided to release it for free because it's more fun to have tons of scores on the leaderboards (and also because the target audience of people who like both esoteric programming languages <em>and</em> zachlikes is probably too small to be profitable).</p>
                <p>Having said that, this game is officially released as <strong>indieware</strong> (a term I just made up), meaning:</p>
                <p>If you enjoyed this game and are feeling generous, please take whatever amount of money you think would have been reasonable to pay for SIC-1 and go buy some other indie game you've been eyeing. I'm sure the authors will appreciate your support. Thanks!</p>
                <p>&mdash; Jared Krinke (2022)</p>
                <p className="creditFooter">To view third party licenses, <TextButton text="click here" onClick={() => this.messageBoxPush(this.createMessageLicenses())} />.</p>
            </>,
        };
    }

    private createMessageMailViewer(initialMailId?: string): MessageBoxContent {
        const nextPuzzle = this.getNextPuzzle();
        return {
            title: "Electronic Mail",
            width: "none",
            body: <MailViewer
                ref={this.mailViewer}
                mails={Sic1DataManager.getData().inbox ?? []}
                initialMailId={initialMailId}
                currentPuzzleTitle={this.state.puzzle.title}
                onClearMessageBoxRequested={() => this.messageBoxClear()}
                onPuzzleListRequested={(type: PuzzleListTypes, title?: string) => this.messageBoxReplace(this.createMessagePuzzleList(type, title))}
                onNextPuzzleRequested={nextPuzzle ? () => this.messageBoxReplace(this.createMessagePuzzleList("puzzle", nextPuzzle.title)) : null}
                onCreditsRequested={() => this.messageBoxPush(this.createMessageCredits())}
                onManualInGameRequested={() => this.mailViewer?.current?.selectMail?.(Sic1Root.manualMailId)}
                onManualInNewWindowRequested={() => this.openManualInNewWindow(false)}
                onMailRead={id => {
                    if (id === "epilogue") {
                        this.ensureAchievement("EPILOGUE");
                    }
                }}
            />,
        };
    }

    private createMessageLeaderboard(): MessageBoxContent {
        const promise = Platform.service.getLeaderboardAsync();
        return {
            title: "Leaderboard",
            body: <>
                <p>Here are the current top employees of SIC Systems' engineering department:</p>
                <Sic1Leaderboard promise={promise} />
            </>,
        };
    }

    private createMessageCompilationError(error: CompilationError): MessageBoxContent {
        return {
            title: "Compilation Error",
            body: <>
                <h3>Compilation Error!</h3>
                <p>{error.message}</p>
                {
                    error.context
                    ?
                        <>
                            <p>On line {error.context.sourceLineNumber}:</p>
                            <p>{error.context.sourceLine}</p>
                        </>
                    : null
                }
            </>,
        };
    }

    private createMessageHalt(): MessageBoxContent {
        return {
            title: "Program Halted",
            body: <>
                <h3>Program Halted</h3>
                <p>The program halted itself by branching to "@HALT" (address 255).</p>
                <p>All of your assigned tasks require the program to repeat indefinitely, so this is an error that must be corrected.</p>
            </>,
        }
    }

    private createMessageNoProgram(): MessageBoxContent {
        return {
            title: "No Program",
            body: <>
                <h3>No Program Loaded!</h3>
                <p>Please compile and load a program.</p>
            </>,
        }
    }

    private createMessageAvoision(): MessageBoxContent {
        return {
            title: "Avoision",
            body: <>
                <AvoisionUI
                    colorScheme={this.props.colorScheme}
                    onClosed={() => this.playPuzzleMusic()}
                    onAchievement={() => this.ensureAchievement("AVOISION")}
                    />
            </>,
        };
    }

    private start() {
        const data = Sic1DataManager.getData();
        if (data.introCompleted) {
            this.messageBoxPush(this.createMessagePuzzleList("userStats"));
        } else {
            this.messageBoxPush(this.createMessageIntro());
        }

        const showMigrationPrompt = data.introCompleted && ((data.generation === undefined) || (data.generation < currentUserDataGeneration));
        if (showMigrationPrompt) {
            this.messageBoxPush(this.createMessageMigrationPrompt());
        }

        this.playPuzzleMusic();
    }

    private createMessagePuzzleList(type: PuzzleListTypes, title?: string): MessageBoxContent {
        return {
            title: "Program Inventory",
            width: "none",
            body: <PuzzleList
                initialItemType={type}
                initialItemTitle={title}
                onLoadPuzzleRequested={(puzzle, solutionName) => this.loadPuzzle(puzzle, solutionName)}
                hasUnreadMessages={hasUnreadMail()}
                onOpenMailViewerRequested={() => this.messageBoxReplace(this.createMessageMailViewer())}
                currentPuzzleIsSolved={Sic1DataManager.getPuzzleData(this.state.puzzle.title).solved}
                onClearMessageBoxRequested={() => this.messageBoxClear()}
                onPlayAvoisionRequested={() => {
                    Music.pause();
                    this.messageBoxReplace(this.createMessagePuzzleList("avoision"));
                    this.messageBoxPush(this.createMessageAvoision());
                }}
                onShowMessageBox={(content) => this.messageBoxPush(content)}
                onCloseMessageBox={() => this.messageBoxPop()}

                nextPuzzle={this.getNextPuzzle()}
            />
        };
    }

    private messageBoxReplace(messageBoxContent: MessageBoxContent) {
        this.setState(state => ({ messageBoxQueue: [messageBoxContent, ...state.messageBoxQueue.slice(1)] }));
    }

    private messageBoxPush(messageBoxContent: MessageBoxContent)  {
        this.setState(state => ({
            messageBoxQueue: [messageBoxContent, ...state.messageBoxQueue],
            previousFocus: state.previousFocus ?? document.activeElement,
        }));
    }

    private messageBoxClear() {
        this.setState(state => ({
            messageBoxQueue: [],
            previousFocus: undefined,
        }));
    }

    private messageBoxPop() {
        this.setState(state => ({
            messageBoxQueue: state.messageBoxQueue.slice(1),
            previousFocus: (state.messageBoxQueue.length === 1) ? undefined : state.previousFocus,
        }));
    }

    private playPuzzleMusic(): void {
        Music.play(this.state.puzzle.song ?? "default");
    }

    public componentDidMount() {
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("beforeunload", this.beforeUnloadHandler);
        Platform.onClosing = () => this.saveProgress();
        this.start();
    }

    public componentWillUnmount() {
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
        Platform.onClosing = undefined;
    }

    public componentDidUpdate(previousProps: Readonly<Sic1RootProps>, previousState: Readonly<Sic1RootState>, snapshot: any): void {
        const previousFocus = previousState.previousFocus;
        if ((this.state.previousFocus === undefined) && previousFocus) {
            if ((document.activeElement !== previousFocus) && document.body.contains(previousFocus) && previousFocus["focus"]) {
                previousFocus["focus"]();
            }
        }
    }

    public render() {
        // If all dialogs have been dismissed, change the song, if needed
        if (this.state.messageBoxQueue.length <= 0) {
            this.playPuzzleMusic();
        }

        return <>
            <Sic1Ide
                ref={this.ide}
                puzzle={this.state.puzzle}
                solutionName={this.state.solutionName}
                defaultCode={this.state.defaultCode}

                onCompilationError={(error) => {
                    this.playSoundIncorrect();
                    this.messageBoxClear();
                    this.messageBoxPush(this.createMessageCompilationError(error));
                }}
                onHalt={() => {
                    this.playSoundIncorrect();
                    this.messageBoxClear();
                    this.messageBoxPush(this.createMessageHalt());
                }}
                onNoProgram={() => {
                    this.playSoundIncorrect();
                    this.messageBoxClear();
                    this.messageBoxPush(this.createMessageNoProgram());

                    // Check for "self-destruct" achievement
                    if (this.ide.current && !this.ide.current.hasError() && this.ide.current.hasReadInput()) {
                        const programBytes = this.ide.current.getProgramBytes();
                        if (programBytes && programBytes.length > 0) {
                            for (const byte of programBytes) {
                                if (byte !== 0) {
                                    // Original program had non-zero content, but now program is empty: achieved!
                                    this.ensureAchievement("ERASE");
                                    break;
                                }
                            }
                        }
                    }
                }}
                onMenuRequested={() => this.toggleMenu() }
                onShowMessageBox={(content) => this.messageBoxPush(content)}
                onCloseMessageBox={() => this.messageBoxPop()}
                onPuzzleCompleted={(cycles, bytes, programBytes) => {
                    this.playSoundCompleted();
                    this.puzzleCompleted(cycles, bytes, programBytes);
                }}
                onSaveRequested={() => this.saveProgress()}

                onOutputCorrect={() => this.playSoundCorrect()}
                onOutputIncorrect={() => this.playSoundIncorrect()}
                />
            {
                (() => {
                    const contents: MessageBoxContent[] = [];
                    const queue = this.state.messageBoxQueue;
                    for (const content of queue) {
                        contents.push(content);

                        // Only continue if this message box is transparent
                        if (!content.transparent) {
                            break;
                        }
                    }

                    return contents.map((content, index) => <MessageBox
                        key={content.title}
                        {...content}
                        zIndex={50 - (10 * index)}
                        onDismissed={() => this.messageBoxPop()}
                        />);
                })()
            }
            <Toaster ref={this.toaster} />
        </>;
    }
}
