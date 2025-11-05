import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea } from '@mui/material';
import { useState } from 'react';

function Home() {
    const navigate = useNavigate();
    const handleClick = (url: string) => {
        navigate(url);
    }

    const [isMenuClick, setMenuClick] = useState<number | null>(null);

    const animationDelay = (action: () => void) => {
        setTimeout(() => {
            action();
        }, 1000);
    }

    return (
        <>
            {
                [
                    { name: "ルーレット", link: "/roulette" }
                ].map((m, i) => {
                    return (
                        <Card
                            className={isMenuClick === null ? '' : isMenuClick !== i ? 'home-menu' : ''}
                            onClick={() => {
                                setMenuClick(i);
                                animationDelay(() => handleClick(m.link))
                            }}
                            key={`menu_${m.name}`}
                        >
                            <CardActionArea
                                style={{
                                    ...cardAreaStyle
                                }}
                                onClick={() => handleClick(m.link)}>
                                {m.name}
                            </CardActionArea>
                        </Card>
                    )
                })
            }
        </>
    );
}

const cardAreaStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    height: "100%",
}

export default Home;