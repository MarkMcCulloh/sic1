declare const React: typeof import("react");

export interface MessageBoxContent {
    title: string;
    modal?: boolean;
    body: React.ReactFragment;
}

interface MessageBoxProperties extends MessageBoxContent {
    onDismissed: () => void;
}

export class MessageBox extends React.Component<MessageBoxProperties> {
    constructor(props: MessageBoxProperties) {
        super(props);
    }

    private close = () => {
        this.props.onDismissed();
    }

    public render() {
        return <>
            <div className="messageBox">
                <div className="messageHeader">
                    {this.props.title}
                    {this.props.modal ? null : <button className="messageClose" onClick={this.close}>X</button>}
                </div>
                <div className="messageBody">
                    {this.props.body}
                </div>
            </div>
            <div className="dimmer" onClick={this.props.modal ? null : this.close}></div>
        </>;
    }
}